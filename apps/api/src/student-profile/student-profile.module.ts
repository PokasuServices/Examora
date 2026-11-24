import { Module } from "@nestjs/common";
import { GamificationModule } from "../gamification/gamification.module";
import {
  AdminCheckpointsController,
  AdminCohortsController,
  StudentProfileController,
} from "./student-profile.controller";
import { StudentProfileService } from "./student-profile.service";

/** Student profile, goals, checkpoints and cohorts (student module redesign, phase 8). */
@Module({
  imports: [GamificationModule],
  controllers: [StudentProfileController, AdminCheckpointsController, AdminCohortsController],
  providers: [StudentProfileService],
})
export class StudentProfileModule {}
