import { Inject, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  NOTIFICATION_DELIVERY_QUEUE,
  type NotificationDeliveryJobData,
} from "./notification.constants";
import { NotificationQueueService } from "./notification-queue.service";
import { NotificationTemplatesService } from "./notification-templates.service";
import {
  EMAIL_CHANNEL_PORT,
  SMS_CHANNEL_PORT,
  WEB_PUSH_CHANNEL_PORT,
  WHATSAPP_CHANNEL_PORT,
  type ChannelSendResult,
  type EmailChannelPort,
  type SmsChannelPort,
  type WebPushChannelPort,
  type WhatsAppChannelPort,
} from "./ports/channel-sender.port";

type DeliveryWithContext = {
  id: string;
  notificationId: string;
  channel: string;
  webPushSubscription: unknown;
  notification: {
    eventType: string;
    title: string;
    body: string;
    data: unknown;
    user: { email: string; phone: string | null };
  };
};

/** Channel escalated to on sustained failure (COMM-MERGED §8, ADR-0019 §7) — WhatsApp is often
 * undeliverable (no WhatsApp account on that number) while SMS almost always is. */
const FALLBACK_CHANNEL: Partial<Record<string, "SMS">> = {
  WHATSAPP: "SMS",
};

/**
 * Renders the template (or falls back to the notification's raw title/body),
 * calls the channel-appropriate port, and updates delivery state (ADR-0019
 * §4/§7). Retry is BullMQ-native (`attempts`+`backoff` set at enqueue time);
 * on the final exhausted attempt, `onSustainedFailure` records a DLQ/alert
 * audit entry and — for channels with a configured fallback — enqueues a new
 * delivery on the fallback channel.
 */
@Processor(NOTIFICATION_DELIVERY_QUEUE)
export class NotificationDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationDeliveryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: NotificationTemplatesService,
    private readonly auditService: AuditService,
    private readonly queue: NotificationQueueService,
    @Inject(EMAIL_CHANNEL_PORT) private readonly emailPort: EmailChannelPort,
    @Inject(SMS_CHANNEL_PORT) private readonly smsPort: SmsChannelPort,
    @Inject(WHATSAPP_CHANNEL_PORT) private readonly whatsappPort: WhatsAppChannelPort,
    @Inject(WEB_PUSH_CHANNEL_PORT) private readonly webPushPort: WebPushChannelPort,
  ) {
    super();
  }

  async process(job: Job<NotificationDeliveryJobData>): Promise<void> {
    const delivery = (await this.prisma.notificationDelivery.findUnique({
      where: { id: job.data.deliveryId },
      include: { notification: { include: { user: true } } },
    })) as DeliveryWithContext | null;
    if (!delivery) {
      this.logger.warn(`Delivery job for missing delivery ${job.data.deliveryId}`);
      return;
    }

    try {
      const { notification } = delivery;
      const template = await this.templates.findActive(
        notification.eventType,
        delivery.channel as never,
      );
      const data = (notification.data as Record<string, unknown> | null) ?? {};
      const subject = template?.subject
        ? this.templates.render(template.subject, data)
        : notification.title;
      const body = template
        ? this.templates.render(template.bodyTemplate, data)
        : notification.body;

      const result = await this.send(delivery, subject, body, data);
      if (!result.success) {
        throw new Error(result.error ?? "Channel send failed");
      }

      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          attempts: { increment: 1 },
          status: "DELIVERED",
          sentAt: new Date(),
          deliveredAt: new Date(),
          providerMessageId: result.providerMessageId,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Delivery ${delivery.id} (${delivery.channel}) failed: ${message}`);
      // COMM-MERGED §7: RETRIED is the state while more attempts remain;
      // FAILED is terminal, only once BullMQ has exhausted `attempts`.
      const totalAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
      const isFinalAttempt = job.attemptsMade + 1 >= totalAttempts;
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          attempts: { increment: 1 },
          status: isFinalAttempt ? "FAILED" : "RETRIED",
          ...(isFinalAttempt ? { failedAt: new Date() } : {}),
          lastError: message,
        },
      });

      if (isFinalAttempt) {
        await this.onSustainedFailure(delivery, message);
      }
      throw error; // let BullMQ retry per the enqueue-time `attempts` config
    }
  }

  /** DLQ + fallback + admin alerting, all foundation-level (ADR-0019 §7, COMM-MERGED §8). */
  private async onSustainedFailure(delivery: DeliveryWithContext, error: string): Promise<void> {
    await this.auditService.record({
      action: "notifications.delivery_exhausted",
      entityType: "NotificationDelivery",
      entityId: delivery.id,
      after: { channel: delivery.channel, error },
    });

    const fallbackChannel = FALLBACK_CHANNEL[delivery.channel];
    if (!fallbackChannel) {
      return;
    }
    const fallbackDelivery = await this.prisma.notificationDelivery.create({
      data: {
        notificationId: delivery.notificationId,
        channel: fallbackChannel,
        status: "QUEUED",
        fallbackFromId: delivery.id,
      },
    });
    await this.queue.enqueueDelivery(fallbackDelivery.id);
  }

  private async send(
    delivery: DeliveryWithContext,
    subject: string,
    body: string,
    data: Record<string, unknown>,
  ): Promise<ChannelSendResult> {
    const user = delivery.notification.user;
    switch (delivery.channel) {
      case "EMAIL":
        return this.emailPort.send({ to: user.email, subject, body });
      case "SMS":
        if (!user.phone) return { success: false, error: "No phone number on file" };
        return this.smsPort.send({ to: user.phone, body });
      case "WHATSAPP":
        if (!user.phone) return { success: false, error: "No phone number on file" };
        return this.whatsappPort.send({ to: user.phone, body });
      case "WEB_PUSH": {
        const subscription = delivery.webPushSubscription as {
          endpoint: string;
          p256dh: string;
          auth: string;
        } | null;
        if (!subscription) return { success: false, error: "No push subscription snapshot" };
        return this.webPushPort.send({ subscription, title: subject, body, data });
      }
      default:
        return { success: false, error: `Unsupported channel: ${delivery.channel}` };
    }
  }
}
