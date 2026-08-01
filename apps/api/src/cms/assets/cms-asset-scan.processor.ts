import { Inject, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { AuditService } from "../../audit/audit.service";
import {
  MALWARE_SCANNER_PORT,
  type MalwareScannerPort,
} from "../../malware-scan/malware-scanner.port";
import { PrismaService } from "../../prisma/prisma.service";
import { STORAGE_PORT, type StoragePort } from "../../storage/storage.port";
import { CMS_ASSET_SCAN_QUEUE, type CmsAssetScanJobData } from "./cms-asset-scan-queue.service";

/** Quarantine-by-default for the Media Library (Sprint 12, ADR-0022 §5). */
@Processor(CMS_ASSET_SCAN_QUEUE)
export class CmsAssetScanProcessor extends WorkerHost {
  private readonly logger = new Logger(CmsAssetScanProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(MALWARE_SCANNER_PORT) private readonly scanner: MalwareScannerPort,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async process(job: Job<CmsAssetScanJobData>): Promise<void> {
    const asset = await this.prisma.cmsAsset.findUnique({ where: { id: job.data.assetId } });
    if (!asset) {
      this.logger.warn(`Scan job for missing CMS asset ${job.data.assetId}`);
      return;
    }

    try {
      const buffer = await this.storage.getObjectBuffer(asset.storageKey);
      const result = await this.scanner.scan(buffer);

      if (result.clean) {
        await this.prisma.cmsAsset.update({
          where: { id: asset.id },
          data: { scanStatus: "CLEAN" },
        });
        return;
      }

      await this.storage.deleteObject(asset.storageKey);
      await this.prisma.cmsAsset.update({
        where: { id: asset.id },
        data: { scanStatus: "INFECTED" },
      });
      await this.auditService.record({
        action: "cms.asset_infected",
        entityType: "CmsAsset",
        entityId: asset.id,
        after: { fileName: asset.fileName, signature: result.signature ?? null },
      });
    } catch (error) {
      this.logger.error(
        `Scan failed for CMS asset ${asset.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.prisma.cmsAsset.update({
        where: { id: asset.id },
        data: { scanStatus: "FAILED" },
      });
      throw error;
    }
  }
}
