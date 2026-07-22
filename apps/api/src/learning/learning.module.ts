import { Module } from "@nestjs/common";
import { AdminProgressController } from "./admin-progress.controller";
import { AdminProgressService } from "./admin-progress.service";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { ProgressController } from "./progress.controller";
import { ProgressService } from "./progress.service";

/**
 * Sprint 3 learning engine (ADR-0013): student catalog + progress tracking and
 * an admin read-only progress dashboard. No enrollment gate; all published
 * content is learnable by any authenticated student.
 */
@Module({
  controllers: [CatalogController, ProgressController, AdminProgressController],
  providers: [CatalogService, ProgressService, AdminProgressService],
  // ProgressService is reused by MentoringModule's Student 360 aggregator
  // (ADR-0016) rather than re-implementing progress queries.
  exports: [ProgressService],
})
export class LearningModule {}
