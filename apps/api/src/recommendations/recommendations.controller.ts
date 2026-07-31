import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/types/request-user";
import { SimilarCoursesQueryDto } from "./dto/similar-courses-query.dto";
import { RecommendationService } from "./recommendation.service";

/** A student's own personalized recommendations (recommendations:read:own, ADR-0021). */
@ApiTags("recommendations")
@Controller("recommendations/me")
@RequirePermissions("recommendations:read:own")
export class RecommendationsController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get("continue-learning")
  @ApiOperation({ summary: "Courses I've started but not finished, ready to resume" })
  async getContinueLearning(@CurrentUser() actor: RequestUser) {
    return this.recommendationService.getContinueLearning(actor.id);
  }

  @Get("courses")
  @ApiOperation({ summary: "Recommended courses based on my active enrollments" })
  async getRecommendedCourses(@CurrentUser() actor: RequestUser) {
    return this.recommendationService.getRecommendedCourses(actor.id);
  }

  @Get("similar-courses")
  @ApiOperation({
    summary: "Courses similar to a given course (defaults to my most-active enrollment)",
  })
  async getSimilarCourses(
    @CurrentUser() actor: RequestUser,
    @Query() query: SimilarCoursesQueryDto,
  ) {
    return this.recommendationService.getSimilarCourses(actor.id, query.courseId);
  }

  @Get("learning-path")
  @ApiOperation({ summary: "Suggested next courses to take" })
  async getLearningPath(@CurrentUser() actor: RequestUser) {
    return this.recommendationService.getLearningPath(actor.id);
  }

  @Get("quizzes")
  @ApiOperation({ summary: "Recommended quizzes based on my active enrollments" })
  async getRecommendedQuizzes(@CurrentUser() actor: RequestUser) {
    return this.recommendationService.getRecommendedQuizzes(actor.id);
  }

  @Get("assignments")
  @ApiOperation({ summary: "Recommended assignments based on my active enrollments" })
  async getRecommendedAssignments(@CurrentUser() actor: RequestUser) {
    return this.recommendationService.getRecommendedAssignments(actor.id);
  }

  @Get("community-discussions")
  @ApiOperation({ summary: "Community discussions related to my enrolled courses" })
  async getRelatedDiscussions(@CurrentUser() actor: RequestUser) {
    return this.recommendationService.getRelatedDiscussions(actor);
  }
}
