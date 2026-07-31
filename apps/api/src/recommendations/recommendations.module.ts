import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { AssessmentModule } from "../assessment/assessment.module";
import { AssignmentsModule } from "../assignments/assignments.module";
import { CommunityModule } from "../community/community.module";
import { LearningModule } from "../learning/learning.module";
import { MentoringModule } from "../mentoring/mentoring.module";
import { AssignmentRecommendationService } from "./assignment/assignment-recommendation.service";
import { CommunityRecommendationService } from "./community/community-recommendation.service";
import { CourseRecommendationService } from "./course/course-recommendation.service";
import { RecommendationFeatureFlagsController } from "./feature-flags/recommendation-feature-flags.controller";
import { RecommendationFeatureFlagsService } from "./feature-flags/recommendation-feature-flags.service";
import { QuizRecommendationService } from "./quiz/quiz-recommendation.service";
import { RecommendationContextService } from "./recommendation-context.service";
import { RecommendationService } from "./recommendation.service";
import { RecommendationsController } from "./recommendations.controller";

/**
 * AI Recommendation Engine (Sprint 11, ADR-0021) — a leaf module: rule-based
 * scoring over existing platform data, no external AI services (ADR-0021
 * §1). Imports LearningModule (CatalogService, ProgressService),
 * AssessmentModule (QuizCatalogService), AssignmentsModule
 * (AssignmentCatalogService), CommunityModule (CommunitySearchService),
 * MentoringModule (MentorFeedbackService), and AnalyticsModule
 * (StudentAnalyticsService) to reuse their existing queries rather than
 * duplicating them.
 */
@Module({
  imports: [
    LearningModule,
    AssessmentModule,
    AssignmentsModule,
    CommunityModule,
    MentoringModule,
    AnalyticsModule,
  ],
  controllers: [RecommendationsController, RecommendationFeatureFlagsController],
  providers: [
    RecommendationContextService,
    CourseRecommendationService,
    QuizRecommendationService,
    AssignmentRecommendationService,
    CommunityRecommendationService,
    RecommendationFeatureFlagsService,
    RecommendationService,
  ],
})
export class RecommendationsModule {}
