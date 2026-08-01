import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@examora/database";
import type { CmsContentType, CmsVersionDiffEntry, CmsWorkflowStatus } from "@examora/types";
import { PrismaService } from "../prisma/prisma.service";

export interface RecordVersionParams {
  contentType: CmsContentType;
  contentId: string;
  snapshot: Record<string, unknown>;
  status: CmsWorkflowStatus;
  actorId: string;
  changeNote?: string;
}

/**
 * Generic Content Version History / Compare / Restore engine (Sprint 12,
 * ADR-0022 §3) — one implementation, shared by Pages/FAQ/Announcements/
 * Banners via the (contentType, contentId) discriminator on
 * CmsContentVersion, rather than duplicated per content type.
 */
@Injectable()
export class CmsVersioningService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The version number `recordVersion` will assign next. Callers use this to
   * stamp the entity row's own `version` column in the same `update()` call
   * that produces the snapshot being recorded, so the two stay in sync.
   */
  async peekNextVersionNumber(contentType: CmsContentType, contentId: string): Promise<number> {
    const last = await this.prisma.cmsContentVersion.findFirst({
      where: { contentType, contentId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    return (last?.versionNumber ?? 0) + 1;
  }

  /** Snapshots the current state after a mutation. Returns the new version number. */
  async recordVersion(params: RecordVersionParams): Promise<number> {
    const last = await this.prisma.cmsContentVersion.findFirst({
      where: { contentType: params.contentType, contentId: params.contentId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    const versionNumber = (last?.versionNumber ?? 0) + 1;
    await this.prisma.cmsContentVersion.create({
      data: {
        contentType: params.contentType,
        contentId: params.contentId,
        versionNumber,
        snapshot: params.snapshot as Prisma.InputJsonValue,
        status: params.status,
        changeNote: params.changeNote,
        createdById: params.actorId,
      },
    });
    return versionNumber;
  }

  async listVersions(contentType: CmsContentType, contentId: string) {
    return this.prisma.cmsContentVersion.findMany({
      where: { contentType, contentId },
      orderBy: { versionNumber: "desc" },
      include: { createdBy: { select: { email: true } } },
    });
  }

  async getVersionOrThrow(contentType: CmsContentType, contentId: string, versionNumber: number) {
    const version = await this.prisma.cmsContentVersion.findUnique({
      where: { contentType_contentId_versionNumber: { contentType, contentId, versionNumber } },
    });
    if (!version) {
      throw new NotFoundException("Version not found");
    }
    return version;
  }

  /** Field-by-field diff between two snapshots — the "Compare Versions" primitive. */
  compareVersions(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): CmsVersionDiffEntry[] {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const diffs: CmsVersionDiffEntry[] = [];
    for (const key of keys) {
      if (JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)) {
        diffs.push({ field: key, before: before[key] ?? null, after: after[key] ?? null });
      }
    }
    return diffs;
  }
}
