import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { CMS_SCHEDULING_QUEUE, type CmsSchedulingJobData } from "./cms-scheduling.constants";
import { CmsPagesService } from "../pages/cms-pages.service";
import { CmsFaqService } from "../faq/cms-faq.service";
import { CmsAnnouncementsService } from "../announcements/cms-announcements.service";
import { CmsBannersService } from "../banners/cms-banners.service";

/**
 * Fires scheduled publish/unpublish transitions (ADR-0022 §4) by dispatching
 * to the right content-type service's `transition()`. Automated transitions
 * are attributed to the content's own `createdById` — there is no
 * system/service-account user in this codebase, and the original author is
 * the most meaningful actor to record on the version history entry.
 */
@Processor(CMS_SCHEDULING_QUEUE)
export class CmsSchedulingProcessor extends WorkerHost {
  private readonly logger = new Logger(CmsSchedulingProcessor.name);

  constructor(
    private readonly pages: CmsPagesService,
    private readonly faq: CmsFaqService,
    private readonly announcements: CmsAnnouncementsService,
    private readonly banners: CmsBannersService,
  ) {
    super();
  }

  async process(job: Job<CmsSchedulingJobData>): Promise<void> {
    const { contentType, contentId, action } = job.data;
    const targetStatus = action === "PUBLISH" ? "PUBLISHED" : "ARCHIVED";

    switch (contentType) {
      case "PAGE": {
        const page = await this.pages.findByIdOrThrow(contentId);
        await this.pages.transition(page.createdById, contentId, targetStatus);
        break;
      }
      case "FAQ": {
        const item = await this.faq.findByIdOrThrow(contentId);
        await this.faq.transition(item.createdById, contentId, targetStatus);
        break;
      }
      case "ANNOUNCEMENT": {
        const item = await this.announcements.findByIdOrThrow(contentId);
        await this.announcements.transition(item.createdById, contentId, targetStatus);
        break;
      }
      case "BANNER": {
        const item = await this.banners.findByIdOrThrow(contentId);
        await this.banners.transition(item.createdById, contentId, targetStatus);
        break;
      }
    }

    this.logger.log(`Fired scheduled ${action} for ${contentType} ${contentId}`);
  }
}
