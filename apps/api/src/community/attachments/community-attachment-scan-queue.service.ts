import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

export const COMMUNITY_ATTACHMENT_SCAN_QUEUE = "community-attachment-scan";

export interface CommunityAttachmentScanJobData {
  attachmentId: string;
}

/**
 * Duplicates Sprint 5's `MalwareScanQueueService` shape rather than
 * genericizing it (ADR-0017) — the processor is compile-time bound to a
 * specific Prisma table, so a second thin queue is cheaper than a risky
 * refactor of working Sprint 5 code.
 */
@Injectable()
export class CommunityAttachmentScanQueueService {
  constructor(
    @InjectQueue(COMMUNITY_ATTACHMENT_SCAN_QUEUE)
    private readonly queue: Queue<CommunityAttachmentScanJobData>,
  ) {}

  async enqueue(attachmentId: string): Promise<void> {
    await this.queue.add(
      "scan",
      { attachmentId },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );
  }
}
