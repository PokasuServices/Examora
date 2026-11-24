import { Module } from "@nestjs/common";
import {
  AdminQuestionReportsController,
  QuestionFeedbackController,
} from "./question-feedback.controller";
import { QuestionFeedbackService } from "./question-feedback.service";

/** Question reports and per-question doubts (student module redesign, phase 5). */
@Module({
  controllers: [QuestionFeedbackController, AdminQuestionReportsController],
  providers: [QuestionFeedbackService],
})
export class QuestionFeedbackModule {}
