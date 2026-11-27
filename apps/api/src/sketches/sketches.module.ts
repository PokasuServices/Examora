import { Module } from "@nestjs/common";
import { AssessmentModule } from "../assessment/assessment.module";
import { CmsModule } from "../cms/cms.module";
import { GamificationModule } from "../gamification/gamification.module";
import { AdminSketchesController, SketchesController } from "./sketches.controller";
import { SketchesService } from "./sketches.service";
import { AdminSketchWorksController, SketchWorksController } from "./sketch-works.controller";
import { SketchWorksService } from "./sketch-works.service";

/** Sketch answers: upload, self/peer/expert ratings (student module redesign, phase 6). */
@Module({
  imports: [AssessmentModule, CmsModule, GamificationModule],
  controllers: [
    SketchesController,
    AdminSketchesController,
    SketchWorksController,
    AdminSketchWorksController,
  ],
  providers: [SketchesService, SketchWorksService],
  exports: [SketchWorksService, SketchesService],
})
export class SketchesModule {}
