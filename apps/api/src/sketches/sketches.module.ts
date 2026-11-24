import { Module } from "@nestjs/common";
import { AssessmentModule } from "../assessment/assessment.module";
import { CmsModule } from "../cms/cms.module";
import { AdminSketchesController, SketchesController } from "./sketches.controller";
import { SketchesService } from "./sketches.service";

/** Sketch answers: upload, self/peer/expert ratings (student module redesign, phase 6). */
@Module({
  imports: [AssessmentModule, CmsModule],
  controllers: [SketchesController, AdminSketchesController],
  providers: [SketchesService],
})
export class SketchesModule {}
