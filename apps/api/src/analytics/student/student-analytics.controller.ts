import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/types/request-user";
import { StudentAnalyticsService } from "./student-analytics.service";

class TimelineQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

/** A student's own analytics dashboard (analytics:read:own, ADR-0020). */
@ApiTags("analytics")
@Controller("analytics/me")
@RequirePermissions("analytics:read:own")
export class StudentAnalyticsController {
  constructor(private readonly analyticsService: StudentAnalyticsService) {}

  @Get("progress")
  @ApiOperation({ summary: "My learning progress summary" })
  async getProgress(@CurrentUser() actor: RequestUser) {
    return this.analyticsService.getLearningProgress(actor.id);
  }

  @Get("course-completion")
  @ApiOperation({ summary: "My per-course completion breakdown" })
  async getCourseCompletion(@CurrentUser() actor: RequestUser) {
    return this.analyticsService.getCourseCompletion(actor.id);
  }

  @Get("quiz-performance")
  @ApiOperation({ summary: "My quiz performance summary" })
  async getQuizPerformance(@CurrentUser() actor: RequestUser) {
    return this.analyticsService.getQuizPerformance(actor.id);
  }

  @Get("assignment-performance")
  @ApiOperation({ summary: "My assignment performance summary" })
  async getAssignmentPerformance(@CurrentUser() actor: RequestUser) {
    return this.analyticsService.getAssignmentPerformance(actor.id);
  }

  @Get("timeline")
  @ApiOperation({ summary: "My recent learning timeline" })
  async getTimeline(@CurrentUser() actor: RequestUser, @Query() query: TimelineQueryDto) {
    return this.analyticsService.getTimeline(actor.id, query.limit);
  }

  @Get("activity")
  @ApiOperation({ summary: "My activity summary (active days, streak)" })
  async getActivity(@CurrentUser() actor: RequestUser) {
    return this.analyticsService.getActivitySummary(actor.id);
  }

  @Get("achievements")
  @ApiOperation({ summary: "My achievement summary" })
  async getAchievements(@CurrentUser() actor: RequestUser) {
    return this.analyticsService.getAchievementSummary(actor.id);
  }
}
