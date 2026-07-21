import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { FileRules } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import { STORAGE_PORT, type StoragePort } from "../../storage/storage.port";
import { AssignmentCatalogService } from "../catalog/assignment-catalog.service";
import { MalwareScanQueueService } from "../malware-scan-queue.service";
import type { AddCommentDto } from "./dto/add-comment.dto";
import type { ConfirmFileDto } from "./dto/confirm-file.dto";
import type { PresignFileDto } from "./dto/presign-file.dto";
import type { UpdateSubmissionDto } from "./dto/update-submission.dto";

const WITH_DETAIL = {
  files: { orderBy: { uploadedAt: "asc" as const } },
  comments: {
    include: { author: { select: { email: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  review: { include: { scores: { include: { criterion: true } } } },
  assignment: { select: { title: true } },
};

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: AssignmentCatalogService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly scanQueue: MalwareScanQueueService,
  ) {}

  /**
   * Idempotent start/resume (ADR-0015, mirrors QuizAttemptsService.start):
   * no existing submission -> create version 1; latest is DRAFT -> resume it;
   * latest is REVISION_REQUESTED -> create the next version; otherwise
   * (SUBMITTED/UNDER_REVIEW/APPROVED) -> return the latest read-only.
   */
  async start(assignmentId: string, studentId: string) {
    await this.catalog.getPublishedOrThrow(assignmentId);

    const latest = await this.prisma.assignmentSubmission.findFirst({
      where: { assignmentId, studentId },
      orderBy: { version: "desc" },
    });

    if (!latest) {
      return this.prisma.assignmentSubmission.create({
        data: { assignmentId, studentId, version: 1, status: "DRAFT" },
      });
    }
    if (latest.status === "DRAFT") {
      return latest;
    }
    if (latest.status === "REVISION_REQUESTED") {
      return this.prisma.assignmentSubmission.create({
        data: { assignmentId, studentId, version: latest.version + 1, status: "DRAFT" },
      });
    }
    return latest;
  }

  async getDetail(id: string, callerId: string) {
    const submission = await this.findAccessibleOrThrow(id, callerId);
    return this.prisma.assignmentSubmission.findUniqueOrThrow({
      where: { id: submission.id },
      include: WITH_DETAIL,
    });
  }

  async listHistory(studentId: string, assignmentId?: string) {
    return this.prisma.assignmentSubmission.findMany({
      where: { studentId, ...(assignmentId ? { assignmentId } : {}) },
      include: {
        assignment: { select: { title: true } },
        review: { select: { obtainedMarks: true, decision: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async updateNotes(submissionId: string, studentId: string, dto: UpdateSubmissionDto) {
    const submission = await this.findOwnedOrThrow(submissionId, studentId);
    this.assertDraft(submission);
    return this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: { notes: dto.notes },
    });
  }

  async createPresignedUpload(submissionId: string, studentId: string, dto: PresignFileDto) {
    const submission = await this.findOwnedOrThrow(submissionId, studentId);
    this.assertDraft(submission);

    const assignment = await this.prisma.assignment.findUniqueOrThrow({
      where: { id: submission.assignmentId },
    });
    const fileRules = assignment.fileRules as unknown as FileRules;

    if (!fileRules.allowedMimeTypes.includes(dto.mimeType)) {
      throw new BadRequestException(
        `File type "${dto.mimeType}" is not allowed for this assignment`,
      );
    }
    if (dto.sizeBytes > fileRules.maxFileSizeMb * 1024 * 1024) {
      throw new BadRequestException(`File exceeds the ${fileRules.maxFileSizeMb}MB limit`);
    }
    const currentCount = await this.prisma.submissionFile.count({ where: { submissionId } });
    if (currentCount >= fileRules.maxFiles) {
      throw new BadRequestException(`This assignment allows at most ${fileRules.maxFiles} files`);
    }

    const key = `assignments/${submission.assignmentId}/${submissionId}/${randomUUID()}-${dto.fileName}`;
    return this.storage.createPresignedUploadUrl({ key, contentType: dto.mimeType });
  }

  /** Creates the SubmissionFile row (scanStatus=PENDING) and enqueues the malware scan. */
  async confirmUpload(submissionId: string, studentId: string, dto: ConfirmFileDto) {
    const submission = await this.findOwnedOrThrow(submissionId, studentId);
    this.assertDraft(submission);

    const file = await this.prisma.submissionFile.create({
      data: {
        submissionId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        storageKey: dto.key,
      },
    });
    await this.scanQueue.enqueue(file.id);
    return file;
  }

  async removeFile(submissionId: string, studentId: string, fileId: string): Promise<void> {
    const submission = await this.findOwnedOrThrow(submissionId, studentId);
    this.assertDraft(submission);

    const file = await this.prisma.submissionFile.findFirst({
      where: { id: fileId, submissionId },
    });
    if (!file) {
      throw new NotFoundException("File not found");
    }
    await this.storage.deleteObject(file.storageKey).catch(() => undefined);
    await this.prisma.submissionFile.delete({ where: { id: fileId } });
  }

  async submitFinal(submissionId: string, studentId: string) {
    const submission = await this.findOwnedOrThrow(submissionId, studentId);
    this.assertDraft(submission);

    const fileCount = await this.prisma.submissionFile.count({ where: { submissionId } });
    if (fileCount === 0) {
      throw new BadRequestException("Attach at least one file before submitting");
    }
    return this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
  }

  async addComment(submissionId: string, authorId: string, dto: AddCommentDto) {
    await this.findAccessibleOrThrow(submissionId, authorId);
    return this.prisma.assignmentComment.create({
      data: { submissionId, authorId, body: dto.body },
      include: { author: { select: { email: true } } },
    });
  }

  async listComments(submissionId: string, callerId: string) {
    await this.findAccessibleOrThrow(submissionId, callerId);
    return this.prisma.assignmentComment.findMany({
      where: { submissionId },
      include: { author: { select: { email: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Only ever resolves for a CLEAN file — PENDING/INFECTED/FAILED all 404 (ADR-0015). */
  async getDownloadUrl(submissionId: string, fileId: string, callerId: string): Promise<string> {
    await this.findAccessibleOrThrow(submissionId, callerId);
    const file = await this.prisma.submissionFile.findFirst({
      where: { id: fileId, submissionId },
    });
    if (!file || file.scanStatus !== "CLEAN") {
      throw new NotFoundException("File not found");
    }
    return this.storage.createPresignedDownloadUrl(file.storageKey);
  }

  private assertDraft(submission: { status: string }): void {
    if (submission.status !== "DRAFT") {
      throw new ConflictException("This submission is no longer editable");
    }
  }

  private async findOwnedOrThrow(id: string, studentId: string) {
    const submission = await this.prisma.assignmentSubmission.findFirst({
      where: { id, studentId },
    });
    if (!submission) {
      throw new NotFoundException("Submission not found");
    }
    return submission;
  }

  /** Accessible to the owning student or the currently-assigned reviewer. */
  private async findAccessibleOrThrow(id: string, callerId: string) {
    const submission = await this.prisma.assignmentSubmission.findFirst({ where: { id } });
    if (!submission || (submission.studentId !== callerId && submission.reviewerId !== callerId)) {
      throw new NotFoundException("Submission not found");
    }
    return submission;
  }
}
