import { Module } from "@nestjs/common";
import { EnrollmentModule } from "../enrollment/enrollment.module";
import { AdminProgressController } from "./admin-progress.controller";
import { AdminProgressService } from "./admin-progress.service";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { ProgressController } from "./progress.controller";
import { ProgressService } from "./progress.service";

/**
 * Sprint 3 learning engine (ADR-0013): student catalog + progress tracking and
 * an admin read-only progress dashboard. Sprint 8 (ADR-0018) adds the
 * enrollment/entitlement gate via EnrollmentModule — a free course (no
 * priceAmount) remains learnable by any authenticated student, unchanged.
 */
@Module({
  imports: [EnrollmentModule],
  controllers: [CatalogController, ProgressController, AdminProgressController],
  providers: [CatalogService, ProgressService, AdminProgressService],
  // ProgressService is reused by MentoringModule's Student 360 aggregator
  // (ADR-0016). CatalogService is reused by CommunityModule (ADR-0017) to
  // validate a thread's optional related-course/lesson link.
  exports: [ProgressService, CatalogService],
})
export class LearningModule {}
