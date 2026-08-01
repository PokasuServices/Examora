import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CmsContentType } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import { STORAGE_PORT, type StoragePort } from "../../storage/storage.port";
import { CmsAssetScanQueueService } from "./cms-asset-scan-queue.service";
import type { ConfirmAssetUploadDto } from "../dto/confirm-asset-upload.dto";
import type { PresignAssetUploadDto } from "../dto/presign-asset-upload.dto";

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

/** Media Library / Asset Management (Sprint 12, ADR-0022 §5), reusing Sprint 5's storage/scan ports. */
@Injectable()
export class CmsAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly scanQueue: CmsAssetScanQueueService,
  ) {}

  async createPresignedUpload(dto: PresignAssetUploadDto) {
    this.assertFileRules(dto.mimeType, dto.sizeBytes);
    const key = `cms/assets/${randomUUID()}-${dto.fileName}`;
    return this.storage.createPresignedUploadUrl({ key, contentType: dto.mimeType });
  }

  async confirmUpload(uploaderId: string, dto: ConfirmAssetUploadDto) {
    this.assertFileRules(dto.mimeType, dto.sizeBytes);
    const asset = await this.prisma.cmsAsset.create({
      data: {
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        altText: dto.altText,
        uploadedById: uploaderId,
      },
    });
    await this.scanQueue.enqueue(asset.id);
    return asset;
  }

  async list(params: { page: number; pageSize: number }) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cmsAsset.findMany({
        include: { uploadedBy: { select: { email: true } }, _count: { select: { usages: true } } },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.cmsAsset.count(),
    ]);
    return { items, total };
  }

  async findByIdOrThrow(id: string) {
    const asset = await this.prisma.cmsAsset.findUnique({
      where: { id },
      include: { uploadedBy: { select: { email: true } }, _count: { select: { usages: true } } },
    });
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }
    return asset;
  }

  /** Only ever resolves for a CLEAN asset — PENDING/INFECTED/FAILED all 404 (mirrors ADR-0015). */
  async getDownloadUrl(id: string): Promise<string> {
    const asset = await this.findByIdOrThrow(id);
    if (asset.scanStatus !== "CLEAN") {
      throw new NotFoundException("Asset not found");
    }
    return this.storage.createPresignedDownloadUrl(asset.storageKey);
  }

  async remove(id: string): Promise<void> {
    const asset = await this.findByIdOrThrow(id);
    const usageCount = await this.prisma.cmsAssetUsage.count({ where: { assetId: id } });
    if (usageCount > 0) {
      throw new BadRequestException("Cannot delete an asset that is still referenced by content");
    }
    await this.storage.deleteObject(asset.storageKey).catch(() => undefined);
    await this.prisma.cmsAsset.delete({ where: { id } });
  }

  /** Records that a content item references this asset — "Asset Reuse" (ADR-0022 §5). */
  async recordUsage(
    assetId: string,
    contentType: CmsContentType,
    contentId: string,
  ): Promise<void> {
    await this.prisma.cmsAssetUsage.upsert({
      where: { assetId_contentType_contentId: { assetId, contentType, contentId } },
      update: {},
      create: { assetId, contentType, contentId },
    });
  }

  async removeUsage(
    assetId: string,
    contentType: CmsContentType,
    contentId: string,
  ): Promise<void> {
    await this.prisma.cmsAssetUsage
      .delete({ where: { assetId_contentType_contentId: { assetId, contentType, contentId } } })
      .catch(() => undefined);
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
