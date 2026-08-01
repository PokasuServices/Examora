import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { CmsAnnouncementsController } from "./announcements/cms-announcements.controller";
import { CmsAnnouncementsService } from "./announcements/cms-announcements.service";
import {
  CMS_ASSET_SCAN_QUEUE,
  CmsAssetScanQueueService,
} from "./assets/cms-asset-scan-queue.service";
import { CmsAssetScanProcessor } from "./assets/cms-asset-scan.processor";
import { CmsAssetsController } from "./assets/cms-assets.controller";
import { CmsAssetsService } from "./assets/cms-assets.service";
import { CmsBannersController } from "./banners/cms-banners.controller";
import { CmsBannersService } from "./banners/cms-banners.service";
import { CmsVersioningService } from "./cms-versioning.service";
import { CmsPublicController } from "./cms-public.controller";
import { CmsFaqController } from "./faq/cms-faq.controller";
import { CmsFaqService } from "./faq/cms-faq.service";
import { CmsPagesController } from "./pages/cms-pages.controller";
import { CmsPagesService } from "./pages/cms-pages.service";
import { CMS_SCHEDULING_QUEUE } from "./scheduling/cms-scheduling.constants";
import { CmsSchedulingQueueService } from "./scheduling/cms-scheduling-queue.service";
import { CmsSchedulingProcessor } from "./scheduling/cms-scheduling.processor";
import { CmsSearchService } from "./search/cms-search.service";

/**
 * CMS & Publishing Workflow (Sprint 12, ADR-0022): Draft -> Review ->
 * Approval -> Publish -> Archive for Pages/FAQ/Announcements/Banners, with
 * shared version history, scheduled publish/unpublish, and a media library
 * reusing Sprint 5's storage/malware-scan ports (both @Global, no import
 * needed). Self-contained — unlike Analytics/Recommendations, CMS has no
 * cross-module data dependencies.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: CMS_ASSET_SCAN_QUEUE }, { name: CMS_SCHEDULING_QUEUE }),
  ],
  controllers: [
    CmsPagesController,
    CmsFaqController,
    CmsAnnouncementsController,
    CmsBannersController,
    CmsAssetsController,
    CmsPublicController,
  ],
  providers: [
    CmsVersioningService,
    CmsPagesService,
    CmsFaqService,
    CmsAnnouncementsService,
    CmsBannersService,
    CmsSchedulingQueueService,
    CmsSchedulingProcessor,
    CmsAssetScanQueueService,
    CmsAssetScanProcessor,
    CmsAssetsService,
    CmsSearchService,
  ],
})
export class CmsModule {}
