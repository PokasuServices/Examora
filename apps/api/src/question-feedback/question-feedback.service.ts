import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  DOUBT_IMAGE_MAX_BYTES,
  DOUBT_IMAGE_TYPES,
  toMediaRef,
  type DoubtKind,
  type PresignedUpload,
  type QuestionDoubtView,
  type QuestionReportView,
} from "@examora/types";
import { shortName } from "../assessment/quiz-attempts/attempt-analysis.service";
import { CmsAssetScanQueueService } from "../cms/assets/cms-asset-scan-queue.service";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_PORT, type StoragePort } from "../storage/storage.port";

/** Claps needed for a doubt to be tagged "popular". */
const POPULAR_CLAPS = 2;

const MEDIA_REF = /media:([0-9a-f-]{36})/gi;
const imageKeyPrefix = (userId: string) => `doubt-images/${userId}/`;

/**
 * "Report question" and per-question doubts/explanations with claps
 * (student module redesign, phase 5). Doubts are visible to anyone who can
 * read quizzes; only their author (or a moderator) can delete one.
 */
@Injectable()
export class QuestionFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly scanQueue: CmsAssetScanQueueService,
  ) {}

  private async assertQuestion(questionId: string): Promise<void> {
    const q = await this.prisma.question.findFirst({
      where: { id: questionId, deletedAt: null },
      select: { id: true },
    });
    if (!q) throw new NotFoundException("Question not found");
  }

  // -------------------------------------------------------------- reports

  async report(userId: string, questionId: string, message: string, attemptId?: string) {
    await this.assertQuestion(questionId);
    await this.prisma.questionReport.create({
      data: { userId, questionId, message: message.trim(), attemptId: attemptId ?? null },
    });
  }

  async listReports(status: "OPEN" | "RESOLVED" | undefined): Promise<QuestionReportView[]> {
    const rows = await this.prisma.questionReport.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { question: { select: { text: true } }, user: { select: { email: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      questionId: r.questionId,
      questionText: r.question.text,
      reporterEmail: r.user.email,
      message: r.message,
      status: r.status === "RESOLVED" ? "RESOLVED" : "OPEN",
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async setReportStatus(id: string, status: "OPEN" | "RESOLVED"): Promise<void> {
    const found = await this.prisma.questionReport.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException("Report not found");
    await this.prisma.questionReport.update({
      where: { id },
      data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null },
    });
  }

  // -------------------------------------------------------------- doubts

  async listDoubts(userId: string, questionId: string): Promise<QuestionDoubtView[]> {
    await this.assertQuestion(questionId);
    const rows = await this.prisma.questionDoubt.findMany({
      where: { questionId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        claps: { select: { userId: true } },
      },
    });
    const view = (r: (typeof rows)[number]) => ({
      id: r.id,
      body: r.body,
      authorName: shortName(r.user.firstName, r.user.lastName, r.user.email),
      isMine: r.userId === userId,
      createdAt: r.createdAt.toISOString(),
      claps: r.claps.length,
      clappedByMe: r.claps.some((c) => c.userId === userId),
    });
    const top = rows.filter((r) => r.parentId === null);
    return top
      .map((r) => ({
        ...view(r),
        kind: r.kind as DoubtKind,
        popular: r.claps.length >= POPULAR_CLAPS,
        replies: rows.filter((c) => c.parentId === r.id).map(view),
      }))
      .sort((a, b) => b.claps - a.claps || a.createdAt.localeCompare(b.createdAt));
  }

  async postDoubt(
    userId: string,
    questionId: string,
    body: string,
    parentId?: string,
    kind: DoubtKind = "DOUBT",
  ) {
    await this.assertQuestion(questionId);
    await this.assertOwnImages(userId, body);
    if (parentId) {
      const parent = await this.prisma.questionDoubt.findFirst({
        where: { id: parentId, questionId, deletedAt: null, parentId: null },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException("Doubt not found");
    }
    await this.prisma.questionDoubt.create({
      data: {
        userId,
        questionId,
        body: body.trim(),
        parentId: parentId ?? null,
        // Replies are comments on a post, never a post of their own kind.
        kind: parentId ? "DOUBT" : kind,
      },
    });
  }

  async toggleClap(userId: string, doubtId: string): Promise<{ clapped: boolean }> {
    const doubt = await this.prisma.questionDoubt.findFirst({
      where: { id: doubtId, deletedAt: null },
      select: { id: true },
    });
    if (!doubt) throw new NotFoundException("Doubt not found");
    const existing = await this.prisma.doubtClap.findUnique({
      where: { doubtId_userId: { doubtId, userId } },
    });
    if (existing) {
      await this.prisma.doubtClap.delete({ where: { doubtId_userId: { doubtId, userId } } });
      return { clapped: false };
    }
    await this.prisma.doubtClap.create({ data: { doubtId, userId } });
    return { clapped: true };
  }

  async deleteDoubt(userId: string, doubtId: string, canModerate: boolean): Promise<void> {
    const doubt = await this.prisma.questionDoubt.findFirst({
      where: { id: doubtId, deletedAt: null },
      select: { userId: true },
    });
    if (!doubt) throw new NotFoundException("Doubt not found");
    if (doubt.userId !== userId && !canModerate) {
      throw new ForbiddenException("You can only delete your own posts");
    }
    await this.prisma.questionDoubt.update({
      where: { id: doubtId },
      data: { deletedAt: new Date() },
    });
  }

  /** A post may only show images its author uploaded for the discussion. */
  private async assertOwnImages(userId: string, body: string): Promise<void> {
    const ids = [...new Set([...body.matchAll(MEDIA_REF)].map((m) => m[1]!.toLowerCase()))];
    if (ids.length === 0) return;
    if (ids.length > 5) throw new BadRequestException("A post can have at most 5 images");
    const owned = await this.prisma.cmsAsset.count({
      where: {
        id: { in: ids },
        uploadedById: userId,
        storageKey: { startsWith: imageKeyPrefix(userId) },
      },
    });
    if (owned !== ids.length) {
      throw new BadRequestException("Posts can only include images you uploaded");
    }
  }

  private assertImage(mimeType: string, sizeBytes: number): void {
    if (!(DOUBT_IMAGE_TYPES as readonly string[]).includes(mimeType)) {
      throw new BadRequestException("Upload a PNG, JPEG, WebP or GIF image");
    }
    if (sizeBytes > DOUBT_IMAGE_MAX_BYTES) {
      throw new BadRequestException("Images must be 1 MB or smaller");
    }
  }

  /** Step 1 of adding an image to a post: a presigned upload URL (1 MB images only). */
  async presignImage(
    userId: string,
    questionId: string,
    file: { fileName: string; mimeType: string; sizeBytes: number },
  ): Promise<PresignedUpload> {
    await this.assertQuestion(questionId);
    this.assertImage(file.mimeType, file.sizeBytes);
    const safeName = file.fileName.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-60) || "image";
    return this.storage.createPresignedUploadUrl({
      key: `${imageKeyPrefix(userId)}${randomUUID()}-${safeName}`,
      contentType: file.mimeType,
      contentLength: file.sizeBytes,
    });
  }

  /**
   * Step 2: record the uploaded image and queue its malware scan. It is
   * served at /media/:id once the scan marks it clean.
   */
  async confirmImage(
    userId: string,
    file: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number },
  ): Promise<{ id: string; ref: string }> {
    this.assertImage(file.mimeType, file.sizeBytes);
    if (!file.storageKey.startsWith(imageKeyPrefix(userId))) {
      throw new BadRequestException("storageKey doesn't belong to you");
    }
    const asset = await this.prisma.cmsAsset.create({
      data: {
        storageKey: file.storageKey,
        fileName: file.fileName.slice(0, 200),
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        altText: "Discussion image",
        uploadedById: userId,
      },
    });
    await this.scanQueue.enqueue(asset.id);
    return { id: asset.id, ref: toMediaRef(asset.id) };
  }

  /** Flags someone else's post for moderators (shows in admin Question reports). */
  async reportDoubt(userId: string, doubtId: string, reason: string): Promise<void> {
    const doubt = await this.prisma.questionDoubt.findFirst({
      where: { id: doubtId, deletedAt: null },
      select: {
        questionId: true,
        userId: true,
        body: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (!doubt) throw new NotFoundException("Post not found");
    if (doubt.userId === userId) throw new BadRequestException("You can't report your own post");
    const excerpt = doubt.body.replace(/\s+/g, " ").slice(0, 200);
    const author = shortName(doubt.user.firstName, doubt.user.lastName, doubt.user.email);
    await this.prisma.questionReport.create({
      data: {
        questionId: doubt.questionId,
        userId,
        message:
          `Discussion post by ${author} (post ${doubtId}): "${excerpt}". Reason: ${reason}`.slice(
            0,
            1000,
          ),
      },
    });
  }
}
