import { Module } from "@nestjs/common";
import { CmsModule } from "../cms/cms.module";
import {
  AdminQuestionReportsController,
  QuestionFeedbackController,
} from "./question-feedback.controller";
import { QuestionFeedbackService } from "./question-feedback.service";

/** Question reports and per-question doubts (student module redesign, phase 5). */
@Module({
  imports: [CmsModule],
  controllers: [QuestionFeedbackController, AdminQuestionReportsController],
  providers: [QuestionFeedbackService],
})
export class QuestionFeedbackModule {}
