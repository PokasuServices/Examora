import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { CmsPageType, CmsWorkflowStatus } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import { CmsSchedulingQueueService } from "../scheduling/cms-scheduling-queue.service";
import { CmsVersioningService } from "../cms-versioning.service";
import { assertValidCmsTransition } from "../cms-workflow.util";
import type { CreateCmsPageDto } from "../dto/create-cms-page.dto";
import type { UpdateCmsPageDto } from "../dto/update-cms-page.dto";

const CONTENT_TYPE = "PAGE" as const;

function toSnapshot(page: {
  title: string;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
}) {
  return {
    title: page.title,
    body: page.body,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
  };
}

/**
 * Landing Pages and Static Pages (Sprint 12, ADR-0022 §2) — one service for
 * both, discriminated by `pageType`. Delegates versioning to
 * CmsVersioningService and scheduling to CmsSchedulingQueueService rather
 * than reimplementing either.
 */
@Injectable()
export class CmsPagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly versioning: CmsVersioningService,
    private readonly schedulingQueue: CmsSchedulingQueueService,
  ) {}

  async create(actorId: string, dto: CreateCmsPageDto) {
    const existing = await this.prisma.cmsPage.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new BadRequestException(`Slug "${dto.slug}" is already in use`);
    }
    const page = await this.prisma.cmsPage.create({
      data: {
        pageType: dto.pageType,
        slug: dto.slug,
        title: dto.title,
        body: dto.body,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        createdById: actorId,
      },
    });
    await this.versioning.recordVersion({
      contentType: CONTENT_TYPE,
      contentId: page.id,
      snapshot: toSnapshot(page),
      status: page.status,
      actorId,
      changeNote: "Created",
    });
    return page;
  }

  async update(actorId: string, id: string, dto: UpdateCmsPageDto) {
    const page = await this.findByIdOrThrow(id);
    if (page.status !== "DRAFT") {
      throw new BadRequestException(
        "Only DRAFT content can be edited — send it back to draft first",
      );
    }
    const nextVersion = await this.versioning.peekNextVersionNumber(CONTENT_TYPE, id);
    const updated = await this.prisma.cmsPage.update({
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

  /** Draft -> Review -> Approval -> Publish -> Archive (ADR-0022 §1). */
  async transition(actorId: string, id: string, targetStatus: CmsWorkflowStatus) {
    const page = await this.findByIdOrThrow(id);
    assertValidCmsTransition(page.status, targetStatus);
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

    const updated = await this.prisma.cmsPage.update({ where: { id }, data });
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
    const page = await this.findByIdOrThrow(id);
    if (page.status !== "APPROVED") {
      throw new BadRequestException("Only APPROVED content can be scheduled to publish");
    }
    await this.schedulingQueue.schedule(CONTENT_TYPE, id, "PUBLISH", at);
    return this.prisma.cmsPage.update({
      where: { id },
      data: { scheduledPublishAt: at, updatedById: actorId },
    });
  }

  async scheduleUnpublish(actorId: string, id: string, at: Date) {
    const page = await this.findByIdOrThrow(id);
    if (page.status !== "PUBLISHED") {
      throw new BadRequestException("Only PUBLISHED content can be scheduled to unpublish");
    }
    await this.schedulingQueue.schedule(CONTENT_TYPE, id, "UNPUBLISH", at);
    return this.prisma.cmsPage.update({
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
    const updated = await this.prisma.cmsPage.update({
      where: { id },
      data: {
        title: snapshot.title as string,
        body: snapshot.body as string,
        seoTitle: (snapshot.seoTitle as string | null) ?? null,
        seoDescription: (snapshot.seoDescription as string | null) ?? null,
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

  async list(params: {
    page: number;
    pageSize: number;
    pageType?: CmsPageType;
    status?: CmsWorkflowStatus;
  }) {
    const where = {
      ...(params.pageType ? { pageType: params.pageType } : {}),
      ...(params.status ? { status: params.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cmsPage.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.cmsPage.count({ where }),
    ]);
    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const page = await this.prisma.cmsPage.findUnique({ where: { id } });
    if (!page) {
      throw new NotFoundException("Page not found");
    }
    return page;
  }

  /** Public read — only ever resolves for a PUBLISHED page. */
  async findPublishedBySlugOrThrow(slug: string) {
    const page = await this.prisma.cmsPage.findUnique({ where: { slug } });
    if (!page || page.status !== "PUBLISHED") {
      throw new NotFoundException("Page not found");
    }
    return page;
  }

  async listPublished(pageType: CmsPageType) {
    return this.prisma.cmsPage.findMany({
      where: { pageType, status: "PUBLISHED" },
      orderBy: { title: "asc" },
    });
  }
}
