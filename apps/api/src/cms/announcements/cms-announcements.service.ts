import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { CmsWorkflowStatus } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import { CmsSchedulingQueueService } from "../scheduling/cms-scheduling-queue.service";
import { CmsVersioningService } from "../cms-versioning.service";
import { assertValidCmsTransition } from "../cms-workflow.util";
import type { CreateCmsAnnouncementDto } from "../dto/create-cms-announcement.dto";
import type { UpdateCmsAnnouncementDto } from "../dto/update-cms-announcement.dto";

const CONTENT_TYPE = "ANNOUNCEMENT" as const;

function toSnapshot(item: { title: string; body: string }) {
  return { title: item.title, body: item.body };
}

/** Announcements (Sprint 12, ADR-0022) — same workflow/versioning/scheduling engine as Pages. */
@Injectable()
export class CmsAnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versioning: CmsVersioningService,
    private readonly schedulingQueue: CmsSchedulingQueueService,
  ) {}

  async create(actorId: string, dto: CreateCmsAnnouncementDto) {
    const item = await this.prisma.cmsAnnouncement.create({
      data: { title: dto.title, body: dto.body, createdById: actorId },
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

  async update(actorId: string, id: string, dto: UpdateCmsAnnouncementDto) {
    const item = await this.findByIdOrThrow(id);
    if (item.status !== "DRAFT") {
      throw new BadRequestException(
        "Only DRAFT content can be edited — send it back to draft first",
      );
    }
    const nextVersion = await this.versioning.peekNextVersionNumber(CONTENT_TYPE, id);
    const updated = await this.prisma.cmsAnnouncement.update({
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

    const updated = await this.prisma.cmsAnnouncement.update({ where: { id }, data });
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
    return this.prisma.cmsAnnouncement.update({
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
    return this.prisma.cmsAnnouncement.update({
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
    const updated = await this.prisma.cmsAnnouncement.update({
      where: { id },
      data: {
        title: snapshot.title as string,
        body: snapshot.body as string,
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
      this.prisma.cmsAnnouncement.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.cmsAnnouncement.count({ where }),
    ]);
    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const item = await this.prisma.cmsAnnouncement.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException("Announcement not found");
    }
    return item;
  }

  async listPublished() {
    return this.prisma.cmsAnnouncement.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
    });
  }
}
