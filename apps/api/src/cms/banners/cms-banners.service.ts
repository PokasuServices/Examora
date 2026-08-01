import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { CmsWorkflowStatus } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import { CmsSchedulingQueueService } from "../scheduling/cms-scheduling-queue.service";
import { CmsVersioningService } from "../cms-versioning.service";
import { CmsAssetsService } from "../assets/cms-assets.service";
import { assertValidCmsTransition } from "../cms-workflow.util";
import type { CreateCmsBannerDto } from "../dto/create-cms-banner.dto";
import type { UpdateCmsBannerDto } from "../dto/update-cms-banner.dto";

const CONTENT_TYPE = "BANNER" as const;

function toSnapshot(item: {
  title: string;
  imageAssetId: string | null;
  linkUrl: string | null;
  placement: string;
  position: number;
}) {
  return {
    title: item.title,
    imageAssetId: item.imageAssetId,
    linkUrl: item.linkUrl,
    placement: item.placement,
    position: item.position,
  };
}

/**
 * Banners (Sprint 12, ADR-0022) — same workflow/versioning/scheduling engine as Pages, plus
 * asset-usage tracking on `imageAssetId` (the only structurally-trackable asset reference among
 * the 4 content types — Pages/FAQ/Announcements have plain-text bodies, not FK asset references).
 */
@Injectable()
export class CmsBannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versioning: CmsVersioningService,
    private readonly schedulingQueue: CmsSchedulingQueueService,
    private readonly assets: CmsAssetsService,
  ) {}

  async create(actorId: string, dto: CreateCmsBannerDto) {
    const item = await this.prisma.cmsBanner.create({
      data: {
        title: dto.title,
        imageAssetId: dto.imageAssetId,
        linkUrl: dto.linkUrl,
        placement: dto.placement,
        position: dto.position ?? 0,
        createdById: actorId,
      },
    });
    if (item.imageAssetId) {
      await this.assets.recordUsage(item.imageAssetId, CONTENT_TYPE, item.id);
    }
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

  async update(actorId: string, id: string, dto: UpdateCmsBannerDto) {
    const item = await this.findByIdOrThrow(id);
    if (item.status !== "DRAFT") {
      throw new BadRequestException(
        "Only DRAFT content can be edited — send it back to draft first",
      );
    }
    const nextVersion = await this.versioning.peekNextVersionNumber(CONTENT_TYPE, id);
    const updated = await this.prisma.cmsBanner.update({
      where: { id },
      data: { ...dto, updatedById: actorId, version: nextVersion },
    });

    if (item.imageAssetId !== updated.imageAssetId) {
      if (item.imageAssetId) {
        await this.assets.removeUsage(item.imageAssetId, CONTENT_TYPE, id);
      }
      if (updated.imageAssetId) {
        await this.assets.recordUsage(updated.imageAssetId, CONTENT_TYPE, id);
      }
    }

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

    const updated = await this.prisma.cmsBanner.update({ where: { id }, data });
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
    return this.prisma.cmsBanner.update({
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
    return this.prisma.cmsBanner.update({
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
    const item = await this.findByIdOrThrow(id);
    const version = await this.versioning.getVersionOrThrow(CONTENT_TYPE, id, versionNumber);
    const snapshot = version.snapshot as Record<string, unknown>;
    const restoredImageAssetId = (snapshot.imageAssetId as string | null) ?? null;
    const nextVersion = await this.versioning.peekNextVersionNumber(CONTENT_TYPE, id);

    const updated = await this.prisma.cmsBanner.update({
      where: { id },
      data: {
        title: snapshot.title as string,
        imageAssetId: restoredImageAssetId,
        linkUrl: (snapshot.linkUrl as string | null) ?? null,
        placement: snapshot.placement as string,
        position: (snapshot.position as number) ?? 0,
        updatedById: actorId,
        version: nextVersion,
      },
    });

    if (item.imageAssetId !== restoredImageAssetId) {
      if (item.imageAssetId) {
        await this.assets.removeUsage(item.imageAssetId, CONTENT_TYPE, id);
      }
      if (restoredImageAssetId) {
        await this.assets.recordUsage(restoredImageAssetId, CONTENT_TYPE, id);
      }
    }

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

  async list(params: {
    page: number;
    pageSize: number;
    status?: CmsWorkflowStatus;
    placement?: string;
  }) {
    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.placement ? { placement: params.placement } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cmsBanner.findMany({
        where,
        orderBy: { position: "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.cmsBanner.count({ where }),
    ]);
    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const item = await this.prisma.cmsBanner.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException("Banner not found");
    }
    return item;
  }

  async listPublished(placement?: string) {
    return this.prisma.cmsBanner.findMany({
      where: { status: "PUBLISHED", ...(placement ? { placement } : {}) },
      orderBy: { position: "asc" },
    });
  }
}
