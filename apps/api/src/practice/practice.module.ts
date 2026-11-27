import { Module } from "@nestjs/common";
import { AdminPracticeController, PracticeController } from "./practice.controller";
import { GamificationModule } from "../gamification/gamification.module";
import { PracticeService } from "./practice.service";
import { TestSharesService } from "./test-shares.service";

/** Practice page (student) and its categories (admin). Student module redesign, phase 4. */
@Module({
  imports: [GamificationModule],
  controllers: [PracticeController, AdminPracticeController],
  providers: [PracticeService, TestSharesService],
  exports: [PracticeService],
})
export class PracticeModule {}
