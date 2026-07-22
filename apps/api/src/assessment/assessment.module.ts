import { Module } from "@nestjs/common";
import { AdminQuizAttemptsController } from "./admin-monitoring/admin-quiz-attempts.controller";
import { AdminQuizAttemptsService } from "./admin-monitoring/admin-quiz-attempts.service";
import { QuestionsController } from "./question-bank/questions.controller";
import { QuestionsService } from "./question-bank/questions.service";
import { QuizCatalogController } from "./quiz-catalog/quiz-catalog.controller";
import { QuizCatalogService } from "./quiz-catalog/quiz-catalog.service";
import { QuizAttemptsController } from "./quiz-attempts/quiz-attempts.controller";
import { QuizAttemptsService } from "./quiz-attempts/quiz-attempts.service";
import { QuizQuestionsController } from "./quizzes/quiz-questions.controller";
import { QuizQuestionsService } from "./quizzes/quiz-questions.service";
import { QuizzesController } from "./quizzes/quizzes.controller";
import { QuizzesService } from "./quizzes/quizzes.service";
import { QuizSectionsController } from "./quizzes/sections.controller";
import { QuizSectionsService } from "./quizzes/sections.service";

/**
 * Sprint 4 assessment & quiz engine (ASSESS-09, ADR-0014): question bank +
 * quiz authoring (admin), the published quiz catalog and timed attempts with
 * frozen-at-start scoring (student), and read-only attempt monitoring /
 * result dashboards (admin).
 */
@Module({
  controllers: [
    QuestionsController,
    QuizzesController,
    QuizSectionsController,
    QuizQuestionsController,
    QuizCatalogController,
    QuizAttemptsController,
    AdminQuizAttemptsController,
  ],
  providers: [
    QuestionsService,
    QuizzesService,
    QuizSectionsService,
    QuizQuestionsService,
    QuizCatalogService,
    QuizAttemptsService,
    AdminQuizAttemptsService,
  ],
  // AdminQuizAttemptsService is reused by MentoringModule's Student 360
  // aggregator (ADR-0016) — it already supports an admin-side userId filter,
  // so no new quiz-history query logic is needed.
  exports: [AdminQuizAttemptsService],
})
export class AssessmentModule {}
