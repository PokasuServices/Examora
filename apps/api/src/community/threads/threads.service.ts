import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@examora/database";
import type { ThreadStatus, ThreadType } from "@examora/types";
import { NotificationsService } from "../../notifications/notifications.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../auth/types/request-user";
import { CatalogService } from "../../learning/catalog.service";
import { QuizCatalogService } from "../../assessment/quiz-catalog/quiz-catalog.service";
import { AssignmentCatalogService } from "../../assignments/catalog/assignment-catalog.service";
import { CommunityAccessService } from "../common/community-access.service";
import { COMMUNITY_AUTHOR_SELECT } from "../common/community-select.util";
import {
  countLikesByTarget,
  getBookmarkedThreadIdSet,
  getFollowedThreadIdSet,
  getLikedTargetIdSet,
} from "../common/community-reactions.util";
import { assertValidThreadStatusTransition } from "../common/thread-status.util";
import { ReputationService } from "../reputation/reputation.service";
import { ForumBoardsService } from "../forums/forum-boards.service";
import type { CreateThreadDto } from "./dto/create-thread.dto";
import type { UpdateThreadDto } from "./dto/update-thread.dto";

export const THREAD_LIST_INCLUDE = {
  board: { select: { title: true } },
  author: { select: COMMUNITY_AUTHOR_SELECT },
  _count: { select: { replies: true } },
} as const;

const REPUTATION_THREAD_CREATED = 5;
const REPUTATION_ANSWER_ACCEPTED = 15;

/**
 * Forum threads and Doubt Resolution questions (ADR-0017 — the same model
 * serves both via `type`). Moderator-only actions (hide/restore/lock/unlock/
 * pin/unpin) live in `ThreadModerationService`, not here — this service only
 * covers author-driven CRUD, the OPEN/CLOSED status toggle, and accepting an
 * answer.
 */
@Injectable()
export class ThreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boardsService: ForumBoardsService,
    private readonly accessService: CommunityAccessService,
    private readonly reputationService: ReputationService,
    private readonly catalogService: CatalogService,
    private readonly quizCatalogService: QuizCatalogService,
    private readonly assignmentCatalogService: AssignmentCatalogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(actor: RequestUser, dto: CreateThreadDto) {
    await this.boardsService.findByIdOrThrow(dto.boardId);
    await this.validateRelatedContent(dto, actor.id);

    const thread = await this.prisma.thread.create({
      data: {
        boardId: dto.boardId,
        authorId: actor.id,
        type: dto.type ?? "DISCUSSION",
        title: dto.title,
        body: dto.body,
        relatedCourseId: dto.relatedCourseId,
        relatedLessonId: dto.relatedLessonId,
        relatedQuizId: dto.relatedQuizId,
        relatedAssignmentId: dto.relatedAssignmentId,
      },
      include: THREAD_LIST_INCLUDE,
    });

    await this.reputationService.award(actor.id, REPUTATION_THREAD_CREATED, "Thread created");
    return thread;
  }

  async list(
    actor: RequestUser,
    params: {
      page: number;
      pageSize: number;
      boardId?: string;
      type?: ThreadType;
      status?: ThreadStatus;
      solved?: boolean;
      authorId?: string;
      ids?: string[];
    },
  ) {
    const isModerator = await this.accessService.isModerator(actor);
    const where: Prisma.ThreadWhereInput = {
      deletedAt: null,
      ...(isModerator ? {} : { isHidden: false }),
      ...(params.boardId ? { boardId: params.boardId } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.solved === undefined ? {} : { isSolved: params.solved }),
      ...(params.authorId ? { authorId: params.authorId } : {}),
      ...(params.ids ? { id: { in: params.ids } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.thread.findMany({
        where,
        include: THREAD_LIST_INCLUDE,
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.thread.count({ where }),
    ]);

    return { items, total };
  }

  async getByIdOrThrow(actor: RequestUser, id: string) {
    const thread = await this.prisma.thread.findFirst({
      where: { id, deletedAt: null },
      include: THREAD_LIST_INCLUDE,
    });
    if (!thread) {
      throw new NotFoundException("Thread not found");
    }
    if (thread.isHidden && !(await this.accessService.isModerator(actor))) {
      throw new NotFoundException("Thread not found");
    }

    await this.prisma.thread.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    return thread;
  }

  async update(actor: RequestUser, id: string, dto: UpdateThreadDto) {
    const thread = await this.getByIdOrThrow(actor, id);
    await this.accessService.assertOwnerOrModerator(actor, thread.authorId);
    if (thread.isLocked && !(await this.accessService.isModerator(actor))) {
      throw new ForbiddenException("This thread is locked");
    }

    return this.prisma.thread.update({
      where: { id },
      data: { title: dto.title, body: dto.body },
      include: THREAD_LIST_INCLUDE,
    });
  }

  async remove(actor: RequestUser, id: string): Promise<void> {
    const thread = await this.getByIdOrThrow(actor, id);
    await this.accessService.assertOwnerOrModerator(actor, thread.authorId);
    await this.prisma.thread.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async setStatus(actor: RequestUser, id: string, status: ThreadStatus) {
    const thread = await this.getByIdOrThrow(actor, id);
    await this.accessService.assertOwnerOrModerator(actor, thread.authorId);
    if (thread.isLocked && !(await this.accessService.isModerator(actor))) {
      throw new ForbiddenException("This thread is locked");
    }
    assertValidThreadStatusTransition(thread.status, status);

    return this.prisma.thread.update({
      where: { id },
      data: { status },
      include: THREAD_LIST_INCLUDE,
    });
  }

  /** Marks a reply as the accepted answer (Doubt Resolution, ADR-0017). QUESTION threads only. */
  async acceptAnswer(actor: RequestUser, threadId: string, replyId: string) {
    const thread = await this.getByIdOrThrow(actor, threadId);
    if (thread.type !== "QUESTION") {
      throw new BadRequestException("Only questions can have an accepted answer");
    }
    await this.accessService.assertOwnerOrModerator(actor, thread.authorId);

    const reply = await this.prisma.reply.findFirst({
      where: { id: replyId, threadId, deletedAt: null },
    });
    if (!reply) {
      throw new NotFoundException("Reply not found on this thread");
    }

    await this.prisma.$transaction([
      this.prisma.reply.updateMany({
        where: { threadId, isAcceptedAnswer: true },
        data: { isAcceptedAnswer: false },
      }),
      this.prisma.reply.update({ where: { id: replyId }, data: { isAcceptedAnswer: true } }),
      this.prisma.thread.update({ where: { id: threadId }, data: { isSolved: true } }),
    ]);
    await this.reputationService.award(
      reply.authorId,
      REPUTATION_ANSWER_ACCEPTED,
      "Answer accepted",
    );

    if (reply.authorId !== thread.authorId) {
      await this.notificationsService.enqueue({
        userId: reply.authorId,
        eventType: "community.answer_accepted",
        category: "community",
        title: "Your answer was accepted",
        body: `Your answer to "${thread.title}" was marked as the accepted answer.`,
        data: { threadId, replyId },
      });
    }

    return this.getByIdOrThrow(actor, threadId);
  }

  async unacceptAnswer(actor: RequestUser, threadId: string) {
    const thread = await this.getByIdOrThrow(actor, threadId);
    await this.accessService.assertOwnerOrModerator(actor, thread.authorId);

    await this.prisma.$transaction([
      this.prisma.reply.updateMany({
        where: { threadId, isAcceptedAnswer: true },
        data: { isAcceptedAnswer: false },
      }),
      this.prisma.thread.update({ where: { id: threadId }, data: { isSolved: false } }),
    ]);

    return this.getByIdOrThrow(actor, threadId);
  }

  /** List view enrichment: aggregate like counts only (no viewer-scoped flags — cheaper for pagination). */
  async listSummaries(actor: RequestUser, params: Parameters<ThreadsService["list"]>[1]) {
    const { items, total } = await this.list(actor, params);
    const likeCounts = await countLikesByTarget(
      this.prisma,
      "THREAD",
      items.map((item) => item.id),
    );
    return {
      items: items.map((item) => ({ ...item, likeCount: likeCounts.get(item.id) ?? 0 })),
      total,
    };
  }

  /** Detail view enrichment: like count plus this viewer's like/bookmark/follow state. */
  async getDetailForViewer(actor: RequestUser, id: string) {
    const thread = await this.getByIdOrThrow(actor, id);
    const [likeCounts, likedSet, bookmarkedSet, followedSet] = await Promise.all([
      countLikesByTarget(this.prisma, "THREAD", [thread.id]),
      getLikedTargetIdSet(this.prisma, actor.id, "THREAD", [thread.id]),
      getBookmarkedThreadIdSet(this.prisma, actor.id, [thread.id]),
      getFollowedThreadIdSet(this.prisma, actor.id, [thread.id]),
    ]);
    return {
      ...thread,
      likeCount: likeCounts.get(thread.id) ?? 0,
      isLikedByViewer: likedSet.has(thread.id),
      isBookmarkedByViewer: bookmarkedSet.has(thread.id),
      isFollowedByViewer: followedSet.has(thread.id),
    };
  }

  private async validateRelatedContent(
    dto: {
      relatedCourseId?: string;
      relatedLessonId?: string;
      relatedQuizId?: string;
      relatedAssignmentId?: string;
    },
    actorId: string,
  ): Promise<void> {
    const setCount = [
      dto.relatedCourseId,
      dto.relatedLessonId,
      dto.relatedQuizId,
      dto.relatedAssignmentId,
    ].filter((value) => value !== undefined).length;
    if (setCount > 1) {
      throw new BadRequestException("A thread can link to at most one piece of related content");
    }

    if (dto.relatedCourseId) {
      await this.catalogService.getPublishedCourseOrThrow(dto.relatedCourseId);
    }
    if (dto.relatedLessonId) {
      await this.catalogService.getLessonForStudent(dto.relatedLessonId, actorId);
    }
    if (dto.relatedQuizId) {
      await this.quizCatalogService.getPublishedQuizOrThrow(dto.relatedQuizId);
    }
    if (dto.relatedAssignmentId) {
      await this.assignmentCatalogService.getPublishedOrThrow(dto.relatedAssignmentId);
    }
  }
}
