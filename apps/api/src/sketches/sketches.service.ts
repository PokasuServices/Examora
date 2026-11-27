import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@examora/database";
import type {
  SketchCommentView,
  SketchGalleryItem,
  SketchReviewQueueItem,
  SketchView,
} from "@examora/types";
import { toCriteria } from "../assessment/assessment.mappers";
import { shortName } from "../assessment/quiz-attempts/attempt-analysis.service";
import { QuizAttemptsService } from "../assessment/quiz-attempts/quiz-attempts.service";
import type { QuestionSnapshot } from "../assessment/quiz-attempts/attempt-snapshot.types";
import { CmsAssetScanQueueService } from "../cms/assets/cms-asset-scan-queue.service";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_PORT, type StoragePort } from "../storage/storage.port";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
const FINISHED = ["SUBMITTED", "AUTO_SUBMITTED"] as const;

type Scores = Record<string, number>;

const ANSWER_INCLUDE = {
  question: { select: { id: true, text: true, criteria: true } },
  attempt: {
    select: {
      id: true,
      userId: true,
      status: true,
      submittedAt: true,
      questionSnapshot: true,
      quiz: { select: { title: true } },
      user: { select: { email: true, firstName: true, lastName: true } },
    },
  },
  sketchReview: true,
  peerRatings: { select: { raterId: true, score: true } },
} satisfies Prisma.QuizAttemptAnswerInclude;

type AnswerRow = Prisma.QuizAttemptAnswerGetPayload<{ include: typeof ANSWER_INCLUDE }>;

const SKETCH_STAFF_ROLES = ["ADMINISTRATOR", "MENTOR", "REVIEWER"];

/** Staff who mark sketches and may comment on any of them. */
export function isSketchStaff(roles: string[]): boolean {
  return roles.some((r) => SKETCH_STAFF_ROLES.includes(r));
}

/** Validates a criterion → 1..5 score map against the question's criteria. */
export function cleanScores(criteria: string[], scores: Scores): Scores {
  const out: Scores = {};
  for (const c of criteria) {
    const v = scores[c];
    if (!Number.isInteger(v) || v! < 1 || v! > 5) {
      throw new BadRequestException(`Rate "${c}" from 1 to 5`);
    }
    out[c] = v!;
  }
  return out;
}

/**
 * Sketch (UPLOAD) answers: upload during a test, self-rating, a peer gallery
 * that unlocks after self-rating, and expert marking that feeds back into the
 * attempt score (student module redesign, phase 6).
 */
@Injectable()
export class SketchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attempts: QuizAttemptsService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly scanQueue: CmsAssetScanQueueService,
  ) {}

  // ------------------------------------------------------------ upload

  private assertImage(mimeType: string, sizeBytes: number): void {
    if (!IMAGE_TYPES.includes(mimeType)) {
      throw new BadRequestException("Upload a PNG, JPEG or WebP image");
    }
    if (sizeBytes > MAX_BYTES) throw new BadRequestException("Images must be 10 MB or smaller");
  }

  async presign(
    userId: string,
    attemptId: string,
    questionId: string,
    file: { fileName: string; mimeType: string; sizeBytes: number },
  ) {
    this.assertImage(file.mimeType, file.sizeBytes);
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, userId, status: "IN_PROGRESS" },
      select: { id: true },
    });
    if (!attempt) throw new NotFoundException("Open attempt not found");
    const safe = file.fileName.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-60) || "sketch";
    return this.storage.createPresignedUploadUrl({
      key: `sketches/${attemptId}/${questionId}/${randomUUID()}-${safe}`,
      contentType: file.mimeType,
      contentLength: file.sizeBytes,
    });
  }

  async confirm(
    userId: string,
    attemptId: string,
    questionId: string,
    file: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number },
  ): Promise<{ ref: string }> {
    this.assertImage(file.mimeType, file.sizeBytes);
    if (!file.storageKey.startsWith(`sketches/${attemptId}/${questionId}/`)) {
      throw new BadRequestException("storageKey doesn't belong to this question");
    }
    const asset = await this.prisma.cmsAsset.create({
      data: {
        storageKey: file.storageKey,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        altText: "Student sketch",
        uploadedById: userId,
      },
    });
    await this.scanQueue.enqueue(asset.id);
    await this.attempts.attachUpload(attemptId, userId, questionId, asset.id);
    return { ref: `media:${asset.id}` };
  }

  // ------------------------------------------------------------ views

  private marksFor(row: AnswerRow): number {
    const snap = row.attempt.questionSnapshot as unknown as QuestionSnapshot;
    return snap.find((s) => s.questionId === row.questionId)?.marks ?? 0;
  }

  private toView(row: AnswerRow): SketchView {
    const peers = row.peerRatings;
    return {
      answerId: row.id,
      questionId: row.questionId,
      questionText: row.question.text,
      criteria: toCriteria(row.question.criteria),
      marks: this.marksFor(row),
      imageRef: `media:${row.uploadAssetId}`,
      selfScores: (row.sketchReview?.selfScores as Scores | null) ?? null,
      expertScores: (row.sketchReview?.expertScores as Scores | null) ?? null,
      expertComment: row.sketchReview?.expertComment ?? null,
      marksAwarded:
        row.sketchReview?.expertReviewedAt && row.marksAwarded !== null
          ? Number(row.marksAwarded)
          : null,
      peerAverage:
        peers.length === 0
          ? null
          : Math.round((peers.reduce((s, p) => s + p.score, 0) / peers.length) * 10) / 10,
      peerCount: peers.length,
    };
  }

  async mine(userId: string): Promise<SketchView[]> {
    const rows = await this.prisma.quizAttemptAnswer.findMany({
      where: { uploadAssetId: { not: null }, attempt: { userId, status: { in: [...FINISHED] } } },
      include: ANSWER_INCLUDE,
      orderBy: { answeredAt: "desc" },
    });
    return rows.map((r) => this.toView(r));
  }

  private async ownFinishedAnswer(userId: string, answerId: string): Promise<AnswerRow> {
    const row = await this.prisma.quizAttemptAnswer.findUnique({
      where: { id: answerId },
      include: ANSWER_INCLUDE,
    });
    if (!row || row.attempt.userId !== userId || !row.uploadAssetId) {
      throw new NotFoundException("Sketch not found");
    }
    if (!FINISHED.includes(row.attempt.status as (typeof FINISHED)[number])) {
      throw new BadRequestException("Submit the test before rating your sketch");
    }
    return row;
  }

  async selfRate(userId: string, answerId: string, scores: Scores): Promise<SketchView> {
    const row = await this.ownFinishedAnswer(userId, answerId);
    const clean = cleanScores(toCriteria(row.question.criteria), scores);
    await this.prisma.sketchReview.upsert({
      where: { answerId },
      create: { answerId, selfScores: clean, selfRatedAt: new Date() },
      update: { selfScores: clean, selfRatedAt: new Date() },
    });
    return this.toView((await this.ownFinishedAnswer(userId, answerId)) as AnswerRow);
  }

  /** The caller may see and rate others' sketches for a question once they've self-rated their own. */
  private async assertGalleryUnlocked(userId: string, questionId: string): Promise<void> {
    const own = await this.prisma.sketchReview.findFirst({
      where: {
        selfRatedAt: { not: null },
        answer: { questionId, attempt: { userId } },
      },
      select: { id: true },
    });
    if (!own) {
      throw new ForbiddenException("Upload and rate your own sketch first to see others' work");
    }
  }

  async gallery(userId: string, questionId: string): Promise<SketchGalleryItem[]> {
    await this.assertGalleryUnlocked(userId, questionId);
    const rows = await this.prisma.quizAttemptAnswer.findMany({
      where: {
        questionId,
        uploadAssetId: { not: null },
        attempt: { status: { in: [...FINISHED] }, userId: { not: userId } },
      },
      include: ANSWER_INCLUDE,
      orderBy: { answeredAt: "desc" },
      take: 60,
    });
    const clean = new Set(
      (
        await this.prisma.cmsAsset.findMany({
          where: { id: { in: rows.map((r) => r.uploadAssetId!) }, scanStatus: "CLEAN" },
          select: { id: true },
        })
      ).map((a) => a.id),
    );
    return rows
      .filter((r) => clean.has(r.uploadAssetId!))
      .map((r) => {
        const v = this.toView(r);
        const u = r.attempt.user;
        return {
          answerId: r.id,
          authorName: shortName(u.firstName, u.lastName, u.email),
          imageRef: v.imageRef,
          peerAverage: v.peerAverage,
          peerCount: v.peerCount,
          myRating: r.peerRatings.find((p) => p.raterId === userId)?.score ?? null,
        };
      });
  }

  async peerRate(userId: string, answerId: string, score: number): Promise<void> {
    const row = await this.prisma.quizAttemptAnswer.findUnique({
      where: { id: answerId },
      select: { questionId: true, uploadAssetId: true, attempt: { select: { userId: true } } },
    });
    if (!row?.uploadAssetId) throw new NotFoundException("Sketch not found");
    if (row.attempt.userId === userId)
      throw new BadRequestException("Rate your own sketch with self-rating");
    await this.assertGalleryUnlocked(userId, row.questionId);
    await this.prisma.sketchPeerRating.upsert({
      where: { answerId_raterId: { answerId, raterId: userId } },
      create: { answerId, raterId: userId, score },
      update: { score },
    });
  }

  // ------------------------------------------------------------ pinned comments

  /**
   * Who may read and add pinned comments: the sketch's owner, staff reviewers,
   * and other students who have unlocked that question's gallery.
   */
  private async commentAccess(
    viewer: { id: string; roles: string[] },
    answerId: string,
  ): Promise<{ ownerId: string }> {
    const row = await this.prisma.quizAttemptAnswer.findUnique({
      where: { id: answerId },
      select: {
        questionId: true,
        uploadAssetId: true,
        attempt: { select: { userId: true, status: true } },
      },
    });
    if (
      !row?.uploadAssetId ||
      !FINISHED.includes(row.attempt.status as (typeof FINISHED)[number])
    ) {
      throw new NotFoundException("Sketch not found");
    }
    const ownerId = row.attempt.userId;
    if (ownerId !== viewer.id && !isSketchStaff(viewer.roles)) {
      await this.assertGalleryUnlocked(viewer.id, row.questionId);
    }
    return { ownerId };
  }

  async comments(
    viewer: { id: string; roles: string[] },
    answerId: string,
  ): Promise<SketchCommentView[]> {
    const { ownerId } = await this.commentAccess(viewer, answerId);
    const rows = await this.prisma.sketchComment.findMany({
      where: { answerId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            roles: { select: { role: { select: { name: true } } } },
          },
        },
      },
    });
    return rows.map((c) => {
      const roles = c.author.roles.map((r) => r.role.name);
      return {
        id: c.id,
        x: c.x,
        y: c.y,
        body: c.body,
        authorName: shortName(c.author.firstName, c.author.lastName, c.author.email),
        authorKind: c.author.id === ownerId ? "OWNER" : isSketchStaff(roles) ? "EXPERT" : "PEER",
        mine: c.author.id === viewer.id,
        createdAt: c.createdAt.toISOString(),
      };
    });
  }

  async addComment(
    viewer: { id: string; roles: string[] },
    answerId: string,
    input: { x: number; y: number; body: string },
  ): Promise<SketchCommentView[]> {
    await this.commentAccess(viewer, answerId);
    const body = input.body.trim();
    if (!body) throw new BadRequestException("Write a comment");
    await this.prisma.sketchComment.create({
      data: { answerId, authorId: viewer.id, x: input.x, y: input.y, body },
    });
    return this.comments(viewer, answerId);
  }

  async deleteComment(viewer: { id: string; roles: string[] }, commentId: string): Promise<void> {
    const c = await this.prisma.sketchComment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: { authorId: true },
    });
    if (!c) throw new NotFoundException("Comment not found");
    if (c.authorId !== viewer.id && !isSketchStaff(viewer.roles)) {
      throw new ForbiddenException("You can only delete your own comments");
    }
    await this.prisma.sketchComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  // ------------------------------------------------------------ expert marking

  /** `studentIds` limits the queue to a mentor's own students (null = everyone). */
  async queue(
    status: "pending" | "reviewed",
    studentIds: string[] | null = null,
  ): Promise<SketchReviewQueueItem[]> {
    const rows = await this.prisma.quizAttemptAnswer.findMany({
      where: {
        uploadAssetId: { not: null },
        attempt: {
          status: { in: [...FINISHED] },
          ...(studentIds ? { userId: { in: studentIds } } : {}),
        },
        ...(status === "pending"
          ? { OR: [{ sketchReview: null }, { sketchReview: { expertReviewedAt: null } }] }
          : { sketchReview: { expertReviewedAt: { not: null } } }),
      },
      include: ANSWER_INCLUDE,
      orderBy: { answeredAt: "asc" },
      take: 100,
    });
    return rows.map((r) => ({
      ...this.toView(r),
      studentEmail: r.attempt.user.email,
      quizTitle: r.attempt.quiz.title,
      submittedAt: r.attempt.submittedAt?.toISOString() ?? null,
    }));
  }

  /** The marks a sketch answer is out of (from the attempt's frozen question list). */
  async maxMarks(answerId: string): Promise<number> {
    const row = await this.prisma.quizAttemptAnswer.findUnique({
      where: { id: answerId },
      include: ANSWER_INCLUDE,
    });
    if (!row) throw new NotFoundException("Sketch not found");
    return this.marksFor(row);
  }

  /** Saves the expert's rating and marks, then re-totals the attempt's score. */
  async review(
    expertId: string,
    answerId: string,
    dto: { scores: Scores; comment?: string; marks: number },
  ): Promise<void> {
    const row = await this.prisma.quizAttemptAnswer.findUnique({
      where: { id: answerId },
      include: ANSWER_INCLUDE,
    });
    if (!row?.uploadAssetId) throw new NotFoundException("Sketch not found");
    const max = this.marksFor(row);
    if (dto.marks < 0 || dto.marks > max) {
      throw new BadRequestException(`Marks must be between 0 and ${max}`);
    }
    const scores = cleanScores(toCriteria(row.question.criteria), dto.scores);
    await this.prisma.$transaction(async (tx) => {
      await tx.sketchReview.upsert({
        where: { answerId },
        create: {
          answerId,
          expertScores: scores,
          expertComment: dto.comment ?? null,
          expertId,
          expertReviewedAt: new Date(),
        },
        update: {
          expertScores: scores,
          expertComment: dto.comment ?? null,
          expertId,
          expertReviewedAt: new Date(),
        },
      });
      await tx.quizAttemptAnswer.update({
        where: { id: answerId },
        data: { marksAwarded: dto.marks, isCorrect: dto.marks > 0 },
      });
      // Re-total the attempt now that this sketch has marks.
      const attempt = await tx.quizAttempt.findUniqueOrThrow({ where: { id: row.attemptId } });
      const answers = await tx.quizAttemptAnswer.findMany({ where: { attemptId: row.attemptId } });
      const obtained =
        Math.round(answers.reduce((s, a) => s + Number(a.marksAwarded ?? 0), 0) * 100) / 100;
      const total = Number(attempt.totalMarks);
      const percentage = total > 0 ? Math.round((obtained / total) * 10000) / 100 : 0;
      await tx.quizAttempt.update({
        where: { id: row.attemptId },
        data: {
          obtainedMarks: obtained,
          percentage,
          passed: percentage >= Number(attempt.passingScorePercent),
          correctCount: answers.filter((a) => a.isCorrect === true).length,
          wrongCount: answers.filter((a) => a.isCorrect === false).length,
        },
      });
    });
    // A marked sketch can lift the attempt to 100%: award the test's perfect-score bonus.
    const updated = await this.prisma.quizAttempt.findUnique({
      where: { id: row.attemptId },
      select: {
        userId: true,
        percentage: true,
        quiz: { select: { id: true, perfectBonusXp: true } },
      },
    });
    if (updated) await this.attempts.awardPerfectBonus(updated, updated.quiz);
  }
}
