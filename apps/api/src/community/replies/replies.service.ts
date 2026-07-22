import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../auth/types/request-user";
import { CommunityAccessService } from "../common/community-access.service";
import { COMMUNITY_AUTHOR_SELECT } from "../common/community-select.util";
import { countLikesByTarget, getLikedTargetIdSet } from "../common/community-reactions.util";
import { buildReplyTree } from "../common/reply-tree.util";
import { ReputationService } from "../reputation/reputation.service";
import { ThreadsService } from "../threads/threads.service";
import type { CreateReplyDto } from "./dto/create-reply.dto";
import type { UpdateReplyDto } from "./dto/update-reply.dto";

const REPLY_INCLUDE = { author: { select: COMMUNITY_AUTHOR_SELECT } } as const;
const REPUTATION_REPLY_CREATED = 2;

/**
 * Replies to a thread — also Doubt Resolution answers when
 * `isAcceptedAnswer` is set (ADR-0017). Nested via `parentReplyId`.
 * Moderator-only hide/restore live in `ReplyModerationService`.
 */
@Injectable()
export class RepliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly threadsService: ThreadsService,
    private readonly accessService: CommunityAccessService,
    private readonly reputationService: ReputationService,
  ) {}

  async create(actor: RequestUser, threadId: string, dto: CreateReplyDto) {
    const thread = await this.threadsService.getByIdOrThrow(actor, threadId);
    if (thread.isLocked && !(await this.accessService.isModerator(actor))) {
      throw new ForbiddenException("This thread is locked");
    }
    if (thread.status === "CLOSED" && !(await this.accessService.isModerator(actor))) {
      throw new ForbiddenException("This thread is closed");
    }

    if (dto.parentReplyId) {
      const parent = await this.prisma.reply.findFirst({
        where: { id: dto.parentReplyId, threadId, deletedAt: null },
      });
      if (!parent) {
        throw new NotFoundException("Parent reply not found on this thread");
      }
    }

    const reply = await this.prisma.reply.create({
      data: {
        threadId,
        authorId: actor.id,
        parentReplyId: dto.parentReplyId,
        body: dto.body,
      },
      include: REPLY_INCLUDE,
    });

    await this.reputationService.award(actor.id, REPUTATION_REPLY_CREATED, "Reply posted");
    return reply;
  }

  async list(actor: RequestUser, threadId: string, params: { page: number; pageSize: number }) {
    await this.threadsService.getByIdOrThrow(actor, threadId);
    const isModerator = await this.accessService.isModerator(actor);

    const all = await this.prisma.reply.findMany({
      where: { threadId, deletedAt: null, ...(isModerator ? {} : { isHidden: false }) },
      include: REPLY_INCLUDE,
      orderBy: { createdAt: "asc" },
    });

    const ids = all.map((row) => row.id);
    const [likeCounts, likedSet] = await Promise.all([
      countLikesByTarget(this.prisma, "REPLY", ids),
      getLikedTargetIdSet(this.prisma, actor.id, "REPLY", ids),
    ]);
    const enriched = all.map((row) => ({
      ...row,
      likeCount: likeCounts.get(row.id) ?? 0,
      isLikedByViewer: likedSet.has(row.id),
    }));

    const tree = buildReplyTree(enriched);
    const total = tree.length;
    const start = (params.page - 1) * params.pageSize;
    const items = tree.slice(start, start + params.pageSize);
    return { items, total };
  }

  async findByIdOrThrow(actor: RequestUser, replyId: string) {
    const reply = await this.prisma.reply.findFirst({
      where: { id: replyId, deletedAt: null },
      include: REPLY_INCLUDE,
    });
    if (!reply) {
      throw new NotFoundException("Reply not found");
    }
    if (reply.isHidden && !(await this.accessService.isModerator(actor))) {
      throw new NotFoundException("Reply not found");
    }
    return reply;
  }

  async update(actor: RequestUser, replyId: string, dto: UpdateReplyDto) {
    const reply = await this.findByIdOrThrow(actor, replyId);
    await this.accessService.assertOwnerOrModerator(actor, reply.authorId);

    await this.prisma.reply.update({
      where: { id: replyId },
      data: { body: dto.body },
      include: REPLY_INCLUDE,
    });
    return this.getEnriched(actor, replyId);
  }

  async remove(actor: RequestUser, replyId: string): Promise<void> {
    const reply = await this.findByIdOrThrow(actor, replyId);
    await this.accessService.assertOwnerOrModerator(actor, reply.authorId);
    await this.prisma.reply.update({ where: { id: replyId }, data: { deletedAt: new Date() } });
  }

  /** Single-reply view enrichment: like count plus this viewer's like state. */
  async getEnriched(actor: RequestUser, replyId: string) {
    const reply = await this.findByIdOrThrow(actor, replyId);
    const [likeCounts, likedSet] = await Promise.all([
      countLikesByTarget(this.prisma, "REPLY", [reply.id]),
      getLikedTargetIdSet(this.prisma, actor.id, "REPLY", [reply.id]),
    ]);
    return {
      ...reply,
      likeCount: likeCounts.get(reply.id) ?? 0,
      isLikedByViewer: likedSet.has(reply.id),
    };
  }
}
