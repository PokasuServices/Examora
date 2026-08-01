import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

export const CMS_ASSET_SCAN_QUEUE = "cms-asset-scan";

export interface CmsAssetScanJobData {
  assetId: string;
}

/**
 * Mirrors Sprint 5/7's malware-scan queue shape (own queue, bound to
 * `cmsAsset`) rather than genericizing across domains — the established
 * precedent (ADR-0017's CommunityAttachmentScanQueueService comment).
 */
@Injectable()
export class CmsAssetScanQueueService {
  constructor(
    @InjectQueue(CMS_ASSET_SCAN_QUEUE) private readonly queue: Queue<CmsAssetScanJobData>,
  ) {}

  async enqueue(assetId: string): Promise<void> {
    await this.queue.add(
      "scan",
      { assetId },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );
  }
}
