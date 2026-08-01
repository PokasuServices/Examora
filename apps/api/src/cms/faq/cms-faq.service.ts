import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { CmsWorkflowStatus } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import { CmsSchedulingQueueService } from "../scheduling/cms-scheduling-queue.service";
import { CmsVersioningService } from "../cms-versioning.service";
import { assertValidCmsTransition } from "../cms-workflow.util";
import type { CreateCmsFaqItemDto } from "../dto/create-cms-faq-item.dto";
import type { UpdateCmsFaqItemDto } from "../dto/update-cms-faq-item.dto";

const CONTENT_TYPE = "FAQ" as const;

function toSnapshot(item: {
  question: string;
  answer: string;
  category: string | null;
  position: number;
}) {
  return {
    question: item.question,
    answer: item.answer,
    category: item.category,
    position: item.position,
  };
}

/** FAQ (Sprint 12, ADR-0022) — same workflow/versioning/scheduling engine as Pages. */
@Injectable()
export class CmsFaqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versioning: CmsVersioningService,
    private readonly schedulingQueue: CmsSchedulingQueueService,
  ) {}

  async create(actorId: string, dto: CreateCmsFaqItemDto) {
    const item = await this.prisma.cmsFaqItem.create({
      data: {
        question: dto.question,
        answer: dto.answer,
        category: dto.category,
        position: dto.position ?? 0,
        createdById: actorId,
      },
    });
    await this.versioning.recordVersion({
      contentType: CONTENT_TYPE,
      contentId: item.id,
      snapshot: toSnapshot(item),
      status: item.status,
      actorId,
      changeNote: "Created",
    });
    return item;
  }

  async update(actorId: string, id: string, dto: UpdateCmsFaqItemDto) {
    const item = await this.findByIdOrThrow(id);
    if (item.status !== "DRAFT") {
      throw new BadRequestException(
        "Only DRAFT content can be edited — send it back to draft first",
      );
    }
    const nextVersion = await this.versioning.peekNextVersionNumber(CONTENT_TYPE, id);
    const updated = await this.prisma.cmsFaqItem.update({
      where: { id },
      data: { ...dto, updatedById: actorId, version: nextVersion },
    });
    await this.versioning.recordVersion({
      contentType: CONTENT_TYPE,
      contentId: id,
      snapshot: toSnapshot(updated),
      status: updated.status,
      actorId,
      changeNote: "Edited",
    });
    return updated;
  }

  async transition(actorId: string, id: string, targetStatus: CmsWorkflowStatus) {
    const item = await this.findByIdOrThrow(id);
    assertValidCmsTransition(item.status, targetStatus);
    const nextVersion = await this.versioning.peekNextVersionNumber(CONTENT_TYPE, id);

    const data: {
      status: CmsWorkflowStatus;
      updatedById: string;
      version: number;
      publishedAt?: Date | null;
      scheduledPublishAt?: Date | null;
      scheduledUnpublishAt?: Date | null;
    } = {
      status: targetStatus,
      updatedById: actorId,
      version: nextVersion,
    };
    if (targetStatus === "PUBLISHED") {
      data.publishedAt = new Date();
      data.scheduledPublishAt = null;
      await this.schedulingQueue.cancel(CONTENT_TYPE, id, "PUBLISH");
    }
    if (targetStatus === "ARCHIVED") {
      data.scheduledUnpublishAt = null;
      await this.schedulingQueue.cancel(CONTENT_TYPE, id, "UNPUBLISH");
    }

    const updated = await this.prisma.cmsFaqItem.update({ where: { id }, data });
    await this.versioning.recordVersion({
      contentType: CONTENT_TYPE,
      contentId: id,
      snapshot: toSnapshot(updated),
      status: updated.status,
      actorId,
      changeNote: `Status changed to ${targetStatus}`,
    });
    return updated;
  }

  async schedulePublish(actorId: string, id: string, at: Date) {
    const item = await this.findByIdOrThrow(id);
    if (item.status !== "APPROVED") {
      throw new BadRequestException("Only APPROVED content can be scheduled to publish");
    }
    await this.schedulingQueue.schedule(CONTENT_TYPE, id, "PUBLISH", at);
    return this.prisma.cmsFaqItem.update({
      where: { id },
      data: { scheduledPublishAt: at, updatedById: actorId },
    });
  }

  async scheduleUnpublish(actorId: string, id: string, at: Date) {
    const item = await this.findByIdOrThrow(id);
    if (item.status !== "PUBLISHED") {
      throw new BadRequestException("Only PUBLISHED content can be scheduled to unpublish");
    }
    await this.schedulingQueue.schedule(CONTENT_TYPE, id, "UNPUBLISH", at);
    return this.prisma.cmsFaqItem.update({
      where: { id },
      data: { scheduledUnpublishAt: at, updatedById: actorId },
    });
  }

  async listVersions(id: string) {
    await this.findByIdOrThrow(id);
    return this.versioning.listVersions(CONTENT_TYPE, id);
  }

  async compareVersions(id: string, fromVersion: number, toVersion: number) {
    await this.findByIdOrThrow(id);
    const [from, to] = await Promise.all([
      this.versioning.getVersionOrThrow(CONTENT_TYPE, id, fromVersion),
      this.versioning.getVersionOrThrow(CONTENT_TYPE, id, toVersion),
    ]);
    return this.versioning.compareVersions(
      from.snapshot as Record<string, unknown>,
      to.snapshot as Record<string, unknown>,
    );
  }

  async restoreVersion(actorId: string, id: string, versionNumber: number) {
    await this.findByIdOrThrow(id);
    const version = await this.versioning.getVersionOrThrow(CONTENT_TYPE, id, versionNumber);
    const snapshot = version.snapshot as Record<string, unknown>;
    const nextVersion = await this.versioning.peekNextVersionNumber(CONTENT_TYPE, id);
    const updated = await this.prisma.cmsFaqItem.update({
      where: { id },
      data: {
        question: snapshot.question as string,
        answer: snapshot.answer as string,
        category: (snapshot.category as string | null) ?? null,
        position: (snapshot.position as number) ?? 0,
        updatedById: actorId,
        version: nextVersion,
      },
    });
    await this.versioning.recordVersion({
      contentType: CONTENT_TYPE,
      contentId: id,
      snapshot: toSnapshot(updated),
      status: updated.status,
      actorId,
      changeNote: `Restored version ${versionNumber}`,
    });
    return updated;
  }

  async list(params: { page: number; pageSize: number; status?: CmsWorkflowStatus }) {
    const where = { ...(params.status ? { status: params.status } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cmsFaqItem.findMany({
        where,
        orderBy: { position: "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.cmsFaqItem.count({ where }),
    ]);
    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const item = await this.prisma.cmsFaqItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException("FAQ item not found");
    }
    return item;
  }

  async listPublished() {
    return this.prisma.cmsFaqItem.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { position: "asc" },
    });
  }
}
