import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CommunityTargetType } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../auth/types/request-user";
import { STORAGE_PORT, type StoragePort } from "../../storage/storage.port";
import { CommunityAccessService } from "../common/community-access.service";
import { RepliesService } from "../replies/replies.service";
import { ThreadsService } from "../threads/threads.service";
import { CommunityAttachmentScanQueueService } from "./community-attachment-scan-queue.service";
import type { ConfirmAttachmentDto } from "./dto/confirm-attachment.dto";
import type { PresignAttachmentDto } from "./dto/presign-attachment.dto";

// No per-board configurable file rules this sprint (unlike Assignment's
// FileRules JSON) — a fixed allowlist is adequate for image/document
// attachments on a thread or reply (ADR-0017).
const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

/** Image/document attachments on threads and replies (ADR-0017), reusing Sprint 5's storage/scan ports. */
@Injectable()
export class CommunityAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly threadsService: ThreadsService,
    private readonly repliesService: RepliesService,
    private readonly accessService: CommunityAccessService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly scanQueue: CommunityAttachmentScanQueueService,
  ) {}

  async createPresignedUpload(actor: RequestUser, dto: PresignAttachmentDto) {
    await this.assertOwnsTarget(actor, dto.targetType, dto.targetId);
    this.assertFileRules(dto.mimeType, dto.sizeBytes);

    const key = `community/${dto.targetType.toLowerCase()}/${dto.targetId}/${randomUUID()}-${dto.fileName}`;
    return this.storage.createPresignedUploadUrl({ key, contentType: dto.mimeType });
  }

  async confirmUpload(actor: RequestUser, dto: ConfirmAttachmentDto) {
    await this.assertOwnsTarget(actor, dto.targetType, dto.targetId);
    this.assertFileRules(dto.mimeType, dto.sizeBytes);

    const attachment = await this.prisma.communityAttachment.create({
      data: {
        threadId: dto.targetType === "THREAD" ? dto.targetId : undefined,
        replyId: dto.targetType === "REPLY" ? dto.targetId : undefined,
        uploaderId: actor.id,
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
      },
    });
    await this.scanQueue.enqueue(attachment.id);
    return attachment;
  }

  async listForTarget(actor: RequestUser, targetType: CommunityTargetType, targetId: string) {
    if (targetType === "THREAD") {
      await this.threadsService.getByIdOrThrow(actor, targetId);
      return this.prisma.communityAttachment.findMany({
        where: { threadId: targetId },
        orderBy: { uploadedAt: "asc" },
      });
    }
    await this.repliesService.findByIdOrThrow(actor, targetId);
    return this.prisma.communityAttachment.findMany({
      where: { replyId: targetId },
      orderBy: { uploadedAt: "asc" },
    });
  }

  /** Only ever resolves for a CLEAN file — PENDING/INFECTED/FAILED all 404 (mirrors ADR-0015). */
  async getDownloadUrl(actor: RequestUser, attachmentId: string): Promise<string> {
    const attachment = await this.findAccessibleOrThrow(actor, attachmentId);
    if (attachment.scanStatus !== "CLEAN") {
      throw new NotFoundException("Attachment not found");
    }
    return this.storage.createPresignedDownloadUrl(attachment.storageKey);
  }

  async remove(actor: RequestUser, attachmentId: string): Promise<void> {
    const attachment = await this.findAccessibleOrThrow(actor, attachmentId);
    await this.accessService.assertOwnerOrModerator(actor, attachment.uploaderId);
    await this.storage.deleteObject(attachment.storageKey).catch(() => undefined);
    await this.prisma.communityAttachment.delete({ where: { id: attachmentId } });
  }

  private async findAccessibleOrThrow(actor: RequestUser, attachmentId: string) {
    const attachment = await this.prisma.communityAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }
    if (attachment.threadId) {
      await this.threadsService.getByIdOrThrow(actor, attachment.threadId);
    } else if (attachment.replyId) {
      await this.repliesService.findByIdOrThrow(actor, attachment.replyId);
    }
    return attachment;
  }

  /** Only the thread/reply's own author may attach files to it. */
  private async assertOwnsTarget(
    actor: RequestUser,
    targetType: CommunityTargetType,
    targetId: string,
  ): Promise<void> {
    if (targetType === "THREAD") {
      const thread = await this.threadsService.getByIdOrThrow(actor, targetId);
      if (thread.authorId !== actor.id) {
        throw new BadRequestException("You can only attach files to your own content");
      }
      return;
    }
    const reply = await this.repliesService.findByIdOrThrow(actor, targetId);
    if (reply.authorId !== actor.id) {
      throw new BadRequestException("You can only attach files to your own content");
    }
  }

  private assertFileRules(mimeType: string, sizeBytes: number): void {
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException(`File type "${mimeType}" is not allowed`);
    }
    if (sizeBytes > MAX_SIZE_BYTES) {
      throw new BadRequestException(`File exceeds the ${MAX_SIZE_BYTES / (1024 * 1024)}MB limit`);
    }
  }
}
