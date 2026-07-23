import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EnrollmentModule } from "../enrollment/enrollment.module";
import { AdminSubmissionsController } from "./admin-monitoring/admin-submissions.controller";
import { AdminSubmissionsService } from "./admin-monitoring/admin-submissions.service";
import { AssignmentsAdminController } from "./authoring/assignments-admin.controller";
import { AssignmentsAdminService } from "./authoring/assignments-admin.service";
import { AssignmentCatalogController } from "./catalog/assignment-catalog.controller";
import { AssignmentCatalogService } from "./catalog/assignment-catalog.service";
import { MALWARE_SCAN_QUEUE } from "./malware-scan-queue.service";
import { MalwareScanQueueService } from "./malware-scan-queue.service";
import { MalwareScanProcessor } from "./malware-scan.processor";
import { ReviewerController } from "./reviewer/reviewer.controller";
import { ReviewerService } from "./reviewer/reviewer.service";
import { SubmissionsController } from "./submissions/submissions.controller";
import { SubmissionsService } from "./submissions/submissions.service";
import { TemplatesController } from "./templates/templates.controller";
import { TemplatesService } from "./templates/templates.service";

/**
 * Sprint 5 Creative Assignment Engine (CREATIVE-10 §2-4/§6, ADR-0015):
 * templates + assignment/rubric authoring (admin), the published catalog
 * and submission lifecycle with presigned file upload + async malware
 * scanning (student), rubric review (reviewer), and reviewer
 * assignment/monitoring (admin).
 */
@Module({
  imports: [BullModule.registerQueue({ name: MALWARE_SCAN_QUEUE }), EnrollmentModule],
  // AdminSubmissionsController's "admin/assignments/submissions" must be
  // registered before AssignmentsAdminController's "admin/assignments/:id" —
  // Nest/Express matches routes in registration order, so the dynamic :id
  // route would otherwise swallow "submissions" as an id (TD-025).
  controllers: [
    TemplatesController,
    AdminSubmissionsController,
    AssignmentsAdminController,
    AssignmentCatalogController,
    SubmissionsController,
    ReviewerController,
  ],
  providers: [
    TemplatesService,
    AssignmentsAdminService,
    AssignmentCatalogService,
    SubmissionsService,
    ReviewerService,
    AdminSubmissionsService,
    MalwareScanQueueService,
    MalwareScanProcessor,
  ],
  // SubmissionsService is reused by MentoringModule's Student 360 aggregator
  // (ADR-0016) — listHistory already takes the target student's id, since
  // the student-facing history endpoint was written that way in Sprint 5.
  // AssignmentCatalogService is reused by CommunityModule (ADR-0017) to
  // validate a thread's optional related-assignment link.
  exports: [SubmissionsService, AssignmentCatalogService],
})
export class AssignmentsModule {}
