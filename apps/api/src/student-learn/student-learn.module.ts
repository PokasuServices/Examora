import { Module } from "@nestjs/common";
import { LearningModule } from "../learning/learning.module";
import { AdminLessonQuestionsController } from "./admin-lesson-questions.controller";
import { LearnController } from "./learn.controller";
import { LessonQuestionsService } from "./lesson-questions.service";
import { LearnService } from "./learn.service";

/** Student "Learn" section (student module redesign). Lesson completion reuses LearningModule's ProgressService. */
@Module({
  imports: [LearningModule],
  controllers: [LearnController, AdminLessonQuestionsController],
  providers: [LearnService, LessonQuestionsService],
})
export class StudentLearnModule {}
