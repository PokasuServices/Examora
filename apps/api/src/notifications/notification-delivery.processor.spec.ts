import { Test, type TestingModule } from "@nestjs/testing";
import type { Job } from "bullmq";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { NotificationDeliveryJobData } from "./notification.constants";
import { NotificationDeliveryProcessor } from "./notification-delivery.processor";
import { NotificationQueueService } from "./notification-queue.service";
import { NotificationTemplatesService } from "./notification-templates.service";
import {
  EMAIL_CHANNEL_PORT,
  SMS_CHANNEL_PORT,
  WEB_PUSH_CHANNEL_PORT,
  WHATSAPP_CHANNEL_PORT,
  type ChannelSendResult,
} from "./ports/channel-sender.port";

function job(
  data: NotificationDeliveryJobData,
  opts: { attempts: number; attemptsMade: number },
): Job<NotificationDeliveryJobData> {
  return {
    data,
    opts: { attempts: opts.attempts },
    attemptsMade: opts.attemptsMade,
  } as Job<NotificationDeliveryJobData>;
}

describe("NotificationDeliveryProcessor", () => {
  let processor: NotificationDeliveryProcessor;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let userId: string;
  const suffix = Date.now();

  const emailSend = jest.fn<Promise<ChannelSendResult>, unknown[]>();
  const smsSend = jest.fn<Promise<ChannelSendResult>, unknown[]>();
  const whatsappSend = jest.fn<Promise<ChannelSendResult>, unknown[]>();
  const webPushSend = jest.fn<Promise<ChannelSendResult>, unknown[]>();
  const enqueueDelivery = jest.fn(async () => undefined);

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        NotificationDeliveryProcessor,
        PrismaService,
        NotificationTemplatesService,
        AuditService,
        { provide: NotificationQueueService, useValue: { enqueueDelivery } },
        { provide: EMAIL_CHANNEL_PORT, useValue: { send: emailSend } },
        { provide: SMS_CHANNEL_PORT, useValue: { send: smsSend } },
        { provide: WHATSAPP_CHANNEL_PORT, useValue: { send: whatsappSend } },
        { provide: WEB_PUSH_CHANNEL_PORT, useValue: { send: webPushSend } },
      ],
    }).compile();
    processor = moduleRef.get(NotificationDeliveryProcessor);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const user = await prisma.user.create({
      data: { email: `notif-proc-${suffix}@example.test`, status: "ACTIVE" },
    });
    userId = user.id;
  });

  afterEach(() => {
    emailSend.mockReset();
    smsSend.mockReset();
    whatsappSend.mockReset();
    webPushSend.mockReset();
    enqueueDelivery.mockClear();
  });

  afterAll(async () => {
    await prisma.notificationDelivery.deleteMany({ where: { notification: { userId } } });
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.notificationTemplate.deleteMany({
      where: { eventType: { startsWith: "proc.test." } },
    });
    await prisma.auditLog.deleteMany({ where: { entityType: "NotificationDelivery" } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await moduleRef.close();
  });

  async function makeDelivery(params: {
    eventType: string;
    channel: "EMAIL" | "SMS" | "WHATSAPP" | "WEB_PUSH";
    webPushSubscription?: { endpoint: string; p256dh: string; auth: string };
  }) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        eventType: params.eventType,
        category: "test",
        title: "Raw title",
        body: "Raw body",
      },
    });
    return prisma.notificationDelivery.create({
      data: {
        notificationId: notification.id,
        channel: params.channel,
        status: "QUEUED",
        webPushSubscription: params.webPushSubscription,
      },
    });
  }

  it("marks a successful EMAIL delivery DELIVERED with a provider message id", async () => {
    emailSend.mockResolvedValue({ success: true, providerMessageId: "ses-1" });
    const delivery = await makeDelivery({ eventType: "proc.test.email-ok", channel: "EMAIL" });

    await processor.process(job({ deliveryId: delivery.id }, { attempts: 3, attemptsMade: 0 }));

    const updated = await prisma.notificationDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    });
    expect(updated.status).toBe("DELIVERED");
    expect(updated.providerMessageId).toBe("ses-1");
    expect(updated.sentAt).not.toBeNull();
    expect(updated.deliveredAt).not.toBeNull();
    expect(updated.attempts).toBe(1);
  });

  it("uses the notification's raw title/body when no active template exists", async () => {
    emailSend.mockResolvedValue({ success: true });
    const delivery = await makeDelivery({ eventType: "proc.test.no-template", channel: "EMAIL" });

    await processor.process(job({ deliveryId: delivery.id }, { attempts: 3, attemptsMade: 0 }));

    expect(emailSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Raw title", body: "Raw body" }),
    );
  });

  it("renders an active template's placeholders when one exists for (eventType, channel)", async () => {
    emailSend.mockResolvedValue({ success: true });
    const notification = await prisma.notification.create({
      data: {
        userId,
        eventType: "proc.test.templated",
        category: "test",
        title: "unused",
        body: "unused",
        data: { name: "Sam" },
      },
    });
    await prisma.notificationTemplate.create({
      data: {
        eventType: "proc.test.templated",
        channel: "EMAIL",
        subject: "Hi {{name}}",
        bodyTemplate: "Welcome, {{name}}!",
      },
    });
    const delivery = await prisma.notificationDelivery.create({
      data: { notificationId: notification.id, channel: "EMAIL", status: "QUEUED" },
    });

    await processor.process(job({ deliveryId: delivery.id }, { attempts: 3, attemptsMade: 0 }));

    expect(emailSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Hi Sam", body: "Welcome, Sam!" }),
    );
  });

  it("is a no-op for a job referencing a since-deleted delivery", async () => {
    await expect(
      processor.process(
        job(
          { deliveryId: "00000000-0000-4000-8000-000000000000" },
          { attempts: 3, attemptsMade: 0 },
        ),
      ),
    ).resolves.toBeUndefined();
  });

  it("marks the delivery RETRIED (not FAILED) while attempts remain, and does not DLQ yet", async () => {
    emailSend.mockResolvedValue({ success: false, error: "SES throttled" });
    const delivery = await makeDelivery({ eventType: "proc.test.retry", channel: "EMAIL" });

    await expect(
      processor.process(job({ deliveryId: delivery.id }, { attempts: 3, attemptsMade: 0 })),
    ).rejects.toThrow("SES throttled");

    const updated = await prisma.notificationDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    });
    expect(updated.status).toBe("RETRIED");
    expect(updated.failedAt).toBeNull();
    expect(updated.lastError).toBe("SES throttled");

    const logs = await prisma.auditLog.findMany({
      where: { action: "notifications.delivery_exhausted", entityId: delivery.id },
    });
    expect(logs).toHaveLength(0);
  });

  it("marks the delivery FAILED on the final exhausted attempt and records a DLQ audit entry", async () => {
    emailSend.mockResolvedValue({ success: false, error: "SES rejected" });
    const delivery = await makeDelivery({ eventType: "proc.test.exhausted", channel: "EMAIL" });

    await expect(
      processor.process(job({ deliveryId: delivery.id }, { attempts: 3, attemptsMade: 2 })),
    ).rejects.toThrow("SES rejected");

    const updated = await prisma.notificationDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    });
    expect(updated.status).toBe("FAILED");
    expect(updated.failedAt).not.toBeNull();

    const logs = await prisma.auditLog.findMany({
      where: { action: "notifications.delivery_exhausted", entityId: delivery.id },
    });
    expect(logs).toHaveLength(1);
  });

  it("escalates an exhausted WHATSAPP failure to a fallback SMS delivery", async () => {
    whatsappSend.mockResolvedValue({ success: false, error: "No WhatsApp account" });
    const delivery = await makeDelivery({ eventType: "proc.test.fallback", channel: "WHATSAPP" });

    await expect(
      processor.process(job({ deliveryId: delivery.id }, { attempts: 1, attemptsMade: 0 })),
    ).rejects.toThrow();

    const fallback = await prisma.notificationDelivery.findFirst({
      where: { fallbackFromId: delivery.id },
    });
    expect(fallback?.channel).toBe("SMS");
    expect(fallback?.status).toBe("QUEUED");
    expect(enqueueDelivery).toHaveBeenCalledWith(fallback?.id);
  });

  it("does not fall back on an exhausted EMAIL failure (no fallback channel configured)", async () => {
    emailSend.mockResolvedValue({ success: false, error: "SES rejected" });
    const delivery = await makeDelivery({ eventType: "proc.test.no-fallback", channel: "EMAIL" });

    await expect(
      processor.process(job({ deliveryId: delivery.id }, { attempts: 1, attemptsMade: 0 })),
    ).rejects.toThrow();

    const fallback = await prisma.notificationDelivery.findFirst({
      where: { fallbackFromId: delivery.id },
    });
    expect(fallback).toBeNull();
  });

  it("fails SMS immediately with 'No phone number on file' when the user has none", async () => {
    const delivery = await makeDelivery({ eventType: "proc.test.no-phone", channel: "SMS" });

    await expect(
      processor.process(job({ deliveryId: delivery.id }, { attempts: 1, attemptsMade: 0 })),
    ).rejects.toThrow("No phone number on file");
    expect(smsSend).not.toHaveBeenCalled();
  });

  it("sends WEB_PUSH using the delivery's snapshotted subscription", async () => {
    webPushSend.mockResolvedValue({ success: true, providerMessageId: "201" });
    const delivery = await makeDelivery({
      eventType: "proc.test.webpush",
      channel: "WEB_PUSH",
      webPushSubscription: { endpoint: "https://push.example.test/x", p256dh: "p", auth: "a" },
    });

    await processor.process(job({ deliveryId: delivery.id }, { attempts: 3, attemptsMade: 0 }));

    expect(webPushSend).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription: { endpoint: "https://push.example.test/x", p256dh: "p", auth: "a" },
      }),
    );
    const updated = await prisma.notificationDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    });
    expect(updated.status).toBe("DELIVERED");
  });

  it("fails WEB_PUSH immediately when the delivery has no subscription snapshot", async () => {
    const delivery = await makeDelivery({
      eventType: "proc.test.webpush-missing",
      channel: "WEB_PUSH",
    });

    await expect(
      processor.process(job({ deliveryId: delivery.id }, { attempts: 1, attemptsMade: 0 })),
    ).rejects.toThrow("No push subscription snapshot");
    expect(webPushSend).not.toHaveBeenCalled();
  });
});
