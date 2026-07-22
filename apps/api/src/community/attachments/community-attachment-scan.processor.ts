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
import {
  COMMUNITY_ATTACHMENT_SCAN_QUEUE,
  type CommunityAttachmentScanJobData,
} from "./community-attachment-scan-queue.service";

/**
 * Quarantine-by-default, identical logic to Sprint 5's `MalwareScanProcessor`
 * (ADR-0015/0017) — duplicated because it is bound to `communityAttachment`
 * instead of `submissionFile`; the real S3/ClamAV adapters are reused as-is.
 */
@Processor(COMMUNITY_ATTACHMENT_SCAN_QUEUE)
export class CommunityAttachmentScanProcessor extends WorkerHost {
  private readonly logger = new Logger(CommunityAttachmentScanProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(MALWARE_SCANNER_PORT) private readonly scanner: MalwareScannerPort,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async process(job: Job<CommunityAttachmentScanJobData>): Promise<void> {
    const attachment = await this.prisma.communityAttachment.findUnique({
      where: { id: job.data.attachmentId },
    });
    if (!attachment) {
      this.logger.warn(`Scan job for missing attachment ${job.data.attachmentId}`);
      return;
    }

    try {
      const buffer = await this.storage.getObjectBuffer(attachment.storageKey);
      const result = await this.scanner.scan(buffer);

      if (result.clean) {
        await this.prisma.communityAttachment.update({
          where: { id: attachment.id },
          data: { scanStatus: "CLEAN" },
        });
        return;
      }

      await this.storage.deleteObject(attachment.storageKey);
      await this.prisma.communityAttachment.update({
        where: { id: attachment.id },
        data: { scanStatus: "INFECTED" },
      });
      await this.auditService.record({
        action: "community.attachment_infected",
        entityType: "CommunityAttachment",
        entityId: attachment.id,
        after: { fileName: attachment.fileName, signature: result.signature ?? null },
      });
    } catch (error) {
      this.logger.error(
        `Scan failed for attachment ${attachment.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.prisma.communityAttachment.update({
        where: { id: attachment.id },
        data: { scanStatus: "FAILED" },
      });
      throw error;
    }
  }
}
