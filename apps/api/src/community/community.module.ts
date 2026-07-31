import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AssessmentModule } from "../assessment/assessment.module";
import { AssignmentsModule } from "../assignments/assignments.module";
import { LearningModule } from "../learning/learning.module";
import { CommunityActivityController } from "./activity/community-activity.controller";
import { CommunityActivityService } from "./activity/community-activity.service";
import {
  COMMUNITY_ATTACHMENT_SCAN_QUEUE,
  CommunityAttachmentScanQueueService,
} from "./attachments/community-attachment-scan-queue.service";
import { CommunityAttachmentScanProcessor } from "./attachments/community-attachment-scan.processor";
import { CommunityAttachmentsController } from "./attachments/community-attachments.controller";
import { CommunityAttachmentsService } from "./attachments/community-attachments.service";
import { CommunityAccessService } from "./common/community-access.service";
import { ForumBoardsAdminController } from "./forums/forum-boards-admin.controller";
import { ForumBoardsService } from "./forums/forum-boards.service";
import { ForumCatalogController } from "./forums/forum-catalog.controller";
import { ForumCategoriesAdminController } from "./forums/forum-categories-admin.controller";
import { ForumCategoriesService } from "./forums/forum-categories.service";
import { CommunityModerationController } from "./moderation/community-moderation.controller";
import { CommunityModerationService } from "./moderation/community-moderation.service";
import { CommunityReportsController } from "./moderation/community-reports.controller";
import { CommunityReportsService } from "./moderation/community-reports.service";
import { ReactionsController } from "./reactions/reactions.controller";
import { ReactionsService } from "./reactions/reactions.service";
import { RepliesController } from "./replies/replies.controller";
import { RepliesService } from "./replies/replies.service";
import { ReputationController } from "./reputation/reputation.controller";
import { ReputationService } from "./reputation/reputation.service";
import { CommunitySearchController } from "./search/community-search.controller";
import { CommunitySearchService } from "./search/community-search.service";
import { ThreadsController } from "./threads/threads.controller";
import { ThreadsService } from "./threads/threads.service";

/**
 * Sprint 7 Community & Discussion Module (ADR-0017): forums, Doubt
 * Resolution (Thread.type = QUESTION), likes/bookmarks/follows, a reputation
 * foundation, moderation, search, and attachments. Imports Learning/
 * Assessment/Assignments only for their published-content catalog lookups
 * (validating a thread's optional related-content link) — no business logic
 * is duplicated from those modules.
 */
@Module({
  imports: [
    LearningModule,
    AssessmentModule,
    AssignmentsModule,
    BullModule.registerQueue({ name: COMMUNITY_ATTACHMENT_SCAN_QUEUE }),
  ],
  controllers: [
    ForumCategoriesAdminController,
    ForumBoardsAdminController,
    ForumCatalogController,
    ThreadsController,
    RepliesController,
    ReactionsController,
    ReputationController,
    CommunityActivityController,
    CommunityReportsController,
    CommunityModerationController,
    CommunitySearchController,
    CommunityAttachmentsController,
  ],
  providers: [
    CommunityAccessService,
    ForumCategoriesService,
    ForumBoardsService,
    ThreadsService,
    RepliesService,
    ReactionsService,
    ReputationService,
    CommunityActivityService,
    CommunityReportsService,
    CommunityModerationService,
    CommunitySearchService,
    CommunityAttachmentsService,
    CommunityAttachmentScanQueueService,
    CommunityAttachmentScanProcessor,
  ],
  // CommunitySearchService.search() is reused by RecommendationsModule
  // (Sprint 11, ADR-0021) to surface discussions related to a student's
  // enrolled courses/subjects, rather than duplicating the query.
  exports: [CommunitySearchService],
})
export class CommunityModule {}
