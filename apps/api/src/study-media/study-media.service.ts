import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { toMediaRef, type StudyMediaAsset } from "@examora/types";
import { CmsAssetScanQueueService } from "../cms/assets/cms-asset-scan-queue.service";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_PORT, type StoragePort } from "../storage/storage.port";
import type { ConfirmStudyMediaDto, PresignStudyMediaDto } from "./dto/study-media.dto";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

/**
 * Images and videos for questions, options, explanations and lessons
 * (student module redesign). Uploads go straight to object storage through a
 * presigned URL; rows live in the media-library table so the same malware
 * scan and "only CLEAN assets are served" rule apply.
 *
 * Videos are not malware-scanned: they can be hundreds of MB (the scanner
 * reads whole files into memory and ClamAV rejects large streams), only
 * staff with content:manage can upload them, and browsers play them as media,
 * never execute them. They are marked CLEAN on confirm.
 */
@Injectable()
export class StudyMediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly scanQueue: CmsAssetScanQueueService,
  ) {}

  private assertRules(mimeType: string, sizeBytes: number): "image" | "video" {
    const kind = IMAGE_TYPES.includes(mimeType)
      ? "image"
      : VIDEO_TYPES.includes(mimeType)
        ? "video"
        : null;
    if (!kind) {
      throw new BadRequestException(
        "Only PNG, JPEG, GIF, WebP images and MP4/WebM videos are allowed",
      );
    }
    const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (sizeBytes > max) {
      throw new BadRequestException(`File exceeds the ${max / (1024 * 1024)}MB limit for ${kind}s`);
    }
    return kind;
  }

  async presign(dto: PresignStudyMediaDto) {
    this.assertRules(dto.mimeType, dto.sizeBytes);
    const safeName = dto.fileName.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-80) || "file";
    return this.storage.createPresignedUploadUrl({
      key: `study-media/${randomUUID()}-${safeName}`,
      contentType: dto.mimeType,
      contentLength: dto.sizeBytes,
    });
  }

  async confirm(uploaderId: string, dto: ConfirmStudyMediaDto): Promise<StudyMediaAsset> {
    const kind = this.assertRules(dto.mimeType, dto.sizeBytes);
    const asset = await this.prisma.cmsAsset.create({
      data: {
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        altText: dto.altText,
        uploadedById: uploaderId,
        ...(kind === "video" ? { scanStatus: "CLEAN" as const } : {}),
      },
    });
    if (kind === "image") await this.scanQueue.enqueue(asset.id);
    return this.toDto(asset);
  }

  async get(id: string): Promise<StudyMediaAsset> {
    const asset = await this.prisma.cmsAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException("Media not found");
    return this.toDto(asset);
  }

  /** Short-lived download URL for a CLEAN asset; 404 for anything else (pending, infected, failed, unknown). */
  async getPublicUrl(id: string): Promise<string> {
    const asset = await this.prisma.cmsAsset.findUnique({
      where: { id },
      select: { storageKey: true, scanStatus: true },
    });
    if (!asset || asset.scanStatus !== "CLEAN") throw new NotFoundException("Media not found");
    return this.storage.createPresignedDownloadUrl(asset.storageKey);
  }

  private toDto(asset: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    scanStatus: string;
  }): StudyMediaAsset {
    return {
      id: asset.id,
      ref: toMediaRef(asset.id),
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      scanStatus: asset.scanStatus as StudyMediaAsset["scanStatus"],
    };
  }
}
