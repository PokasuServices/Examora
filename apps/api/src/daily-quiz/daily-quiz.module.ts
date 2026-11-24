import { Module } from "@nestjs/common";
import { GamificationModule } from "../gamification/gamification.module";
import { DailyQuizController } from "./daily-quiz.controller";
import { DailyQuizService } from "./daily-quiz.service";

/** Daily quiz (student module redesign, phase 7). */
@Module({
  imports: [GamificationModule],
  controllers: [DailyQuizController],
  providers: [DailyQuizService],
})
export class DailyQuizModule {}
