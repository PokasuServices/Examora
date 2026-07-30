import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { NotificationChannel } from "@examora/types";
import type { Prisma } from "@examora/database";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationQueueService } from "./notification-queue.service";
import { NotificationPreferencesService } from "./notification-preferences.service";

const NOTIFICATION_DETAIL_INCLUDE = {
  user: { select: { email: true } },
  deliveries: { orderBy: { createdAt: "asc" as const } },
} as const;

export interface EnqueueNotificationParams {
  userId: string;
  eventType: string;
  category: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Additional channels beyond IN_APP (always created) — default none. */
  channels?: NotificationChannel[];
  /** Bypasses mute/DND/opt-out suppression — never for marketing/engagement content (ADR-0019 §5). */
  isTransactional?: boolean;
}

function minuteOfDayInTimezone(date: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return hour * 60 + minute;
  } catch {
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}

/**
 * Core fan-out (ADR-0019). Every notification always gets an IN_APP
 * delivery, resolved synchronously (no queue hop — it's just a DB row); any
 * additional requested channel gets its own NotificationDelivery row and,
 * unless suppressed by preferences, a BullMQ delivery job.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: NotificationQueueService,
    private readonly preferences: NotificationPreferencesService,
  ) {}

  async enqueue(params: EnqueueNotificationParams) {
    const preference = await this.preferences.getOrCreate(params.userId);
    const isTransactional = params.isTransactional ?? false;

    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        eventType: params.eventType,
        category: params.category,
        title: params.title,
        body: params.body,
        data: params.data as Prisma.InputJsonValue | undefined,
        isTransactional,
      },
    });

    // IN_APP is always created and always immediately "delivered" — it's a
    // DB row, not an external send.
    await this.prisma.notificationDelivery.create({
      data: {
        notificationId: notification.id,
        channel: "IN_APP",
        status: "DELIVERED",
        sentAt: new Date(),
        deliveredAt: new Date(),
      },
    });

    const externalChannels = (params.channels ?? []).filter((c) => c !== "IN_APP");
    for (const channel of externalChannels) {
      await this.enqueueChannel(
        notification.id,
        params.userId,
        channel,
        preference,
        isTransactional,
      );
    }

    return notification;
  }

  private async enqueueChannel(
    notificationId: string,
    userId: string,
    channel: NotificationChannel,
    preference: {
      emailEnabled: boolean;
      smsEnabled: boolean;
      whatsappEnabled: boolean;
      webPushEnabled: boolean;
      mutedCategories: string[];
      dndStartMinute: number | null;
      dndEndMinute: number | null;
      timezone: string;
    },
    isTransactional: boolean,
  ): Promise<void> {
    // MOBILE_PUSH has no live integration (ADR-0019 §6) — never enqueued.
    if (channel === "MOBILE_PUSH") {
      return;
    }

    if (!isTransactional) {
      const notification = await this.prisma.notification.findUniqueOrThrow({
        where: { id: notificationId },
        select: { category: true },
      });
      const channelEnabled =
        channel === "EMAIL"
          ? preference.emailEnabled
          : channel === "SMS"
            ? preference.smsEnabled
            : channel === "WHATSAPP"
              ? preference.whatsappEnabled
              : channel === "WEB_PUSH"
                ? preference.webPushEnabled
                : true;
      const muted = preference.mutedCategories.includes(notification.category);
      const inDnd =
        preference.dndStartMinute !== null &&
        preference.dndEndMinute !== null &&
        this.isWithinDnd(preference.dndStartMinute, preference.dndEndMinute, preference.timezone);

      if (!channelEnabled || muted || inDnd) {
        await this.prisma.notificationDelivery.create({
          data: {
            notificationId,
            channel,
            status: "SUPPRESSED",
            suppressedReason: !channelEnabled
              ? "channel_opted_out"
              : muted
                ? "category_muted"
                : "dnd_window",
          },
        });
        return;
      }
    }

    // WEB_PUSH fans out to every registered subscription for the user.
    if (channel === "WEB_PUSH") {
      const subscriptions = await this.prisma.webPushSubscription.findMany({ where: { userId } });
      if (subscriptions.length === 0) {
        await this.prisma.notificationDelivery.create({
          data: { notificationId, channel, status: "FAILED", lastError: "No push subscription" },
        });
        return;
      }
      for (const subscription of subscriptions) {
        const delivery = await this.prisma.notificationDelivery.create({
          data: {
            notificationId,
            channel,
            status: "QUEUED",
            webPushSubscription: {
              endpoint: subscription.endpoint,
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
        });
        await this.queue.enqueueDelivery(delivery.id);
      }
      return;
    }

    const delivery = await this.prisma.notificationDelivery.create({
      data: { notificationId, channel, status: "QUEUED" },
    });
    await this.queue.enqueueDelivery(delivery.id);
  }

  private isWithinDnd(startMinute: number, endMinute: number, timezone: string): boolean {
    if (startMinute === endMinute) return false;
    const minuteOfDay = minuteOfDayInTimezone(new Date(), timezone);
    if (startMinute < endMinute) {
      return minuteOfDay >= startMinute && minuteOfDay < endMinute;
    }
    return minuteOfDay >= startMinute || minuteOfDay < endMinute; // wraps past midnight
  }

  async listMine(userId: string, params: { page: number; pageSize: number; unreadOnly?: boolean }) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(params.unreadOnly ? { isRead: false } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException("Notification not found");
    }
    if (notification.isRead) {
      return notification;
    }
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async listAll(params: {
    page: number;
    pageSize: number;
    userId?: string;
    category?: string;
    eventType?: string;
  }) {
    const where: Prisma.NotificationWhereInput = {
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.eventType ? { eventType: params.eventType } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        include: NOTIFICATION_DETAIL_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total };
  }

  async getByIdOrThrow(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: NOTIFICATION_DETAIL_INCLUDE,
    });
    if (!notification) {
      throw new NotFoundException("Notification not found");
    }
    return notification;
  }

  async getMineDetailOrThrow(userId: string, id: string) {
    const notification = await this.getByIdOrThrow(id);
    if (notification.userId !== userId) {
      throw new ForbiddenException("Not your notification");
    }
    return notification;
  }

  /** Fans out to every targeted user — one Notification+deliveries per recipient (ADR-0019 §9). */
  async broadcast(params: {
    userIds: string[];
    eventType: string;
    category: string;
    title: string;
    body: string;
    channels?: NotificationChannel[];
  }): Promise<{ count: number }> {
    for (const userId of params.userIds) {
      await this.enqueue({
        userId,
        eventType: params.eventType,
        category: params.category,
        title: params.title,
        body: params.body,
        channels: params.channels,
      });
    }
    return { count: params.userIds.length };
  }
}
