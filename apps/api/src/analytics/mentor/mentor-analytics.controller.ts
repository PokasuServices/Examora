import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/types/request-user";
import { MentorAnalyticsService } from "./mentor-analytics.service";

/** A mentor's own analytics dashboard, scoped to their active students (analytics:mentor, ADR-0020). */
@ApiTags("analytics")
@Controller("analytics/mentor")
@RequirePermissions("analytics:mentor")
export class MentorAnalyticsController {
  constructor(private readonly analyticsService: MentorAnalyticsService) {}

  @Get("student-progress")
  @ApiOperation({ summary: "Progress dashboard for my assigned students" })
  async getStudentProgress(@CurrentUser() actor: RequestUser) {
    return this.analyticsService.getStudentProgressDashboard(actor.id);
  }

  @Get("performance-trends")
  @ApiOperation({ summary: "Weekly quiz/assignment performance trend for my students" })
  async getPerformanceTrends(@CurrentUser() actor: RequestUser) {
    return this.analyticsService.getPerformanceTrends(actor.id);
  }

  @Get("quiz-performance")
  @ApiOperation({ summary: "Quiz performance summary for my students" })
  async getQuizPerformance(@CurrentUser() actor: RequestUser) {
    return this.analyticsService.getQuizPerformance(actor.id);
  }

  @Get("assignment-review-stats")
  @ApiOperation({ summary: "My assignment review statistics" })
  async getAssignmentReviewStats(@CurrentUser() actor: RequestUser) {
    return this.analyticsService.getAssignmentReviewStats(actor.id);
  }

  @Get("workload")
  @ApiOperation({ summary: "My caseload and workload utilization" })
  async getWorkload(@CurrentUser() actor: RequestUser) {
    return this.analyticsService.getWorkload(actor.id);
  }

  @Get("engagement")
  @ApiOperation({ summary: "Engagement summary for my assigned students" })
  async getEngagement(@CurrentUser() actor: RequestUser) {
    return this.analyticsService.getEngagementSummary(actor.id);
  }
}
