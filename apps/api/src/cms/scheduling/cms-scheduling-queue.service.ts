import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { CmsContentType } from "@examora/types";
import {
  CMS_SCHEDULING_QUEUE,
  cmsSchedulingJobId,
  type CmsScheduledAction,
  type CmsSchedulingJobData,
} from "./cms-scheduling.constants";

/**
 * Scheduled Publish/Unpublish (Sprint 12, ADR-0022 §4) — a one-time BullMQ
 * delayed job per (contentType, contentId, action), mirroring
 * NotificationQueueService.scheduleNotification's delayed-job pattern
 * (Sprint 9) rather than ADR-0020's repeatable-job scheduler, since a
 * publish/unpublish date is a single point in time, not a cadence.
 */
@Injectable()
export class CmsSchedulingQueueService {
  constructor(
    @InjectQueue(CMS_SCHEDULING_QUEUE) private readonly queue: Queue<CmsSchedulingJobData>,
  ) {}

  /** Cancels any existing job for this (content, action) first, so re-scheduling never double-fires. */
  async schedule(
    contentType: CmsContentType,
    contentId: string,
    action: CmsScheduledAction,
    at: Date,
  ): Promise<void> {
    await this.cancel(contentType, contentId, action);
    const delay = Math.max(0, at.getTime() - Date.now());
    await this.queue.add(
      "transition",
      { contentType, contentId, action },
      { jobId: cmsSchedulingJobId(contentType, contentId, action), delay },
    );
  }

  async cancel(
    contentType: CmsContentType,
    contentId: string,
    action: CmsScheduledAction,
  ): Promise<void> {
    const job = await this.queue.getJob(cmsSchedulingJobId(contentType, contentId, action));
    if (job) {
      await job.remove();
    }
  }
}
