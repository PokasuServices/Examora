import { Injectable } from "@nestjs/common";
import type {
  AdminCommunityAnalytics,
  AdminNotificationDeliveryAnalytics,
  TimeSeriesPoint,
} from "@examora/types";
import type { NotificationChannel } from "@examora/database";
import { PrismaService } from "../../prisma/prisma.service";

const CHANNELS: NotificationChannel[] = ["EMAIL", "SMS", "WHATSAPP", "WEB_PUSH", "IN_APP"];

/** Community and notification-delivery analytics (analytics:admin, ADR-0020 §7). */
@Injectable()
export class AdminEngagementAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCommunityAnalytics(days = 30): Promise<AdminCommunityAnalytics> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const [
      totalThreads,
      totalReplies,
      recentThreads,
      solvedThreads,
      moderationActions,
      openReports,
    ] = await Promise.all([
      this.prisma.thread.count({ where: { deletedAt: null } }),
      this.prisma.reply.count({ where: { deletedAt: null } }),
      this.prisma.thread.findMany({
        where: { createdAt: { gte: since }, deletedAt: null },
        select: { createdAt: true },
      }),
      this.prisma.thread.count({ where: { type: "QUESTION", isSolved: true, deletedAt: null } }),
      this.prisma.thread.count({ where: { moderatedById: { not: null } } }),
      this.prisma.communityReport.count({ where: { status: "PENDING" } }),
    ]);

    const totalQuestions = await this.prisma.thread.count({
      where: { type: "QUESTION", deletedAt: null },
    });

    const byDay = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const day = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      byDay.set(day.toISOString().slice(0, 10), 0);
    }
    for (const t of recentThreads) {
      const key = t.createdAt.toISOString().slice(0, 10);
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    const threadsByDay: TimeSeriesPoint[] = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return {
      totalThreads,
      totalReplies,
      threadsByDay,
      acceptedAnswerRate:
        totalQuestions === 0 ? null : Math.round((solvedThreads / totalQuestions) * 10000) / 100,
      moderationActionsCount: moderationActions,
      openReportsCount: openReports,
    };
  }

  async getNotificationDeliveryAnalytics(): Promise<AdminNotificationDeliveryAnalytics> {
    const totalNotifications = await this.prisma.notification.count();

    const deliveryByChannel = await Promise.all(
      CHANNELS.map(async (channel) => {
        const [queued, delivered, failed, suppressed, total] = await Promise.all([
          this.prisma.notificationDelivery.count({ where: { channel, status: "QUEUED" } }),
          this.prisma.notificationDelivery.count({
            where: {
              channel,
              status: { in: ["DELIVERED", "SENT", "OPENED", "CLICKED", "ACKNOWLEDGED"] },
            },
          }),
          this.prisma.notificationDelivery.count({ where: { channel, status: "FAILED" } }),
          this.prisma.notificationDelivery.count({ where: { channel, status: "SUPPRESSED" } }),
          this.prisma.notificationDelivery.count({ where: { channel } }),
        ]);
        const eligible = total - suppressed;
        return {
          channel,
          queued,
          delivered,
          failed,
          suppressed,
          successRate: eligible === 0 ? null : Math.round((delivered / eligible) * 10000) / 100,
        };
      }),
    );

    const totalEligible = deliveryByChannel.reduce(
      (s, c) => s + c.queued + c.delivered + c.failed,
      0,
    );
    const totalDelivered = deliveryByChannel.reduce((s, c) => s + c.delivered, 0);

    return {
      totalNotifications,
      deliveryByChannel,
      overallSuccessRate:
        totalEligible === 0 ? null : Math.round((totalDelivered / totalEligible) * 10000) / 100,
    };
  }
}
