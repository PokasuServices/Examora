import { Injectable } from "@nestjs/common";
import type { CommunityTargetType } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../auth/types/request-user";
import { countLikesByTarget } from "../common/community-reactions.util";
import { ReputationService } from "../reputation/reputation.service";
import { RepliesService } from "../replies/replies.service";
import { ThreadsService } from "../threads/threads.service";

const REPUTATION_LIKE = 1;

/** Likes (threads + replies), bookmarks and follows (threads only) — ADR-0017. */
@Injectable()
export class ReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly threadsService: ThreadsService,
    private readonly repliesService: RepliesService,
    private readonly reputationService: ReputationService,
  ) {}

  async toggleLike(
    actor: RequestUser,
    targetType: CommunityTargetType,
    targetId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const ownerId = await this.resolveOwnerId(actor, targetType, targetId);

    const existing = await this.prisma.communityLike.findUnique({
      where: { userId_targetType_targetId: { userId: actor.id, targetType, targetId } },
    });

    if (existing) {
      await this.prisma.communityLike.delete({ where: { id: existing.id } });
      if (ownerId !== actor.id) {
        await this.reputationService.award(ownerId, -REPUTATION_LIKE, "Like removed");
      }
    } else {
      await this.prisma.communityLike.create({
        data: { userId: actor.id, targetType, targetId },
      });
      if (ownerId !== actor.id) {
        await this.reputationService.award(ownerId, REPUTATION_LIKE, "Content liked");
      }
    }

    const likeCounts = await countLikesByTarget(this.prisma, targetType, [targetId]);
    return { liked: !existing, likeCount: likeCounts.get(targetId) ?? 0 };
  }

  async toggleBookmark(actor: RequestUser, threadId: string): Promise<{ bookmarked: boolean }> {
    await this.threadsService.getByIdOrThrow(actor, threadId);
    const existing = await this.prisma.communityBookmark.findUnique({
      where: { userId_threadId: { userId: actor.id, threadId } },
    });

    if (existing) {
      await this.prisma.communityBookmark.delete({ where: { id: existing.id } });
      return { bookmarked: false };
    }
    await this.prisma.communityBookmark.create({ data: { userId: actor.id, threadId } });
    return { bookmarked: true };
  }

  async toggleFollow(actor: RequestUser, threadId: string): Promise<{ following: boolean }> {
    await this.threadsService.getByIdOrThrow(actor, threadId);
    const existing = await this.prisma.threadFollow.findUnique({
      where: { userId_threadId: { userId: actor.id, threadId } },
    });

    if (existing) {
      await this.prisma.threadFollow.delete({ where: { id: existing.id } });
      return { following: false };
    }
    await this.prisma.threadFollow.create({ data: { userId: actor.id, threadId } });
    return { following: true };
  }

  async listBookmarkedThreadIds(actor: RequestUser, params: { page: number; pageSize: number }) {
    const where = { userId: actor.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.communityBookmark.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        select: { threadId: true },
      }),
      this.prisma.communityBookmark.count({ where }),
    ]);
    return { threadIds: items.map((item) => item.threadId), total };
  }

  private async resolveOwnerId(
    actor: RequestUser,
    targetType: CommunityTargetType,
    targetId: string,
  ): Promise<string> {
    if (targetType === "THREAD") {
      const thread = await this.threadsService.getByIdOrThrow(actor, targetId);
      return thread.authorId;
    }
    const reply = await this.repliesService.findByIdOrThrow(actor, targetId);
    return reply.authorId;
  }
}
