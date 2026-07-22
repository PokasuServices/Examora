import { Injectable } from "@nestjs/common";
import type { CommunityActivityItem } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Read-only aggregator over a user's own community activity (ADR-0017) —
 * identical reasoning to Student 360's activity timeline (D-50, Sprint 6):
 * merge-and-sort over existing rows rather than a stored table.
 */
@Injectable()
export class CommunityActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async getTimeline(userId: string): Promise<CommunityActivityItem[]> {
    const [threads, replies, likes, reputationEvents] = await Promise.all([
      this.prisma.thread.findMany({
        where: { authorId: userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.reply.findMany({
        where: { authorId: userId, deletedAt: null },
        include: { thread: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.communityLike.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.reputationEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const items: CommunityActivityItem[] = [
      ...threads.map((thread) => ({
        type: "THREAD_CREATED" as const,
        occurredAt: thread.createdAt.toISOString(),
        title: `Started thread: ${thread.title}`,
        description: null,
      })),
      ...replies.map((reply) => ({
        type: "REPLY_POSTED" as const,
        occurredAt: reply.createdAt.toISOString(),
        title: `Replied to: ${reply.thread.title}`,
        description: null,
      })),
      ...likes.map((like) => ({
        type: "LIKE_GIVEN" as const,
        occurredAt: like.createdAt.toISOString(),
        title: `Liked a ${like.targetType.toLowerCase()}`,
        description: null,
      })),
      ...reputationEvents.map((event) => ({
        type: "REPUTATION_EVENT" as const,
        occurredAt: event.createdAt.toISOString(),
        title: event.reason,
        description: `${event.points > 0 ? "+" : ""}${event.points} points`,
      })),
    ];

    return items.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)).slice(0, 50);
  }
}
