import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { AdminAcademicAnalyticsService } from "./admin-academic-analytics.service";
import { AdminCommerceAnalyticsService } from "./admin-commerce-analytics.service";
import { AdminEngagementAnalyticsService } from "./admin-engagement-analytics.service";
import { AdminPlatformAnalyticsService } from "./admin-platform-analytics.service";

class DaysQueryDto {
  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days = 30;
}

/** Cross-platform admin analytics dashboards (analytics:admin, ADR-0020). */
@ApiTags("analytics (admin)")
@Controller("admin/analytics")
@RequirePermissions("analytics:admin")
export class AdminAnalyticsController {
  constructor(
    private readonly platformAnalytics: AdminPlatformAnalyticsService,
    private readonly commerceAnalytics: AdminCommerceAnalyticsService,
    private readonly academicAnalytics: AdminAcademicAnalyticsService,
    private readonly engagementAnalytics: AdminEngagementAnalyticsService,
  ) {}

  @Get("platform")
  @ApiOperation({ summary: "Platform-wide KPI dashboard" })
  async getPlatformDashboard() {
    return this.platformAnalytics.getDashboard();
  }

  @Get("user-growth")
  @ApiOperation({ summary: "New-user growth trend and role breakdown" })
  async getUserGrowth(@Query() query: DaysQueryDto) {
    return this.platformAnalytics.getUserGrowth(query.days);
  }

  @Get("enrollment")
  @ApiOperation({ summary: "Enrollment analytics" })
  async getEnrollmentAnalytics(@Query() query: DaysQueryDto) {
    return this.commerceAnalytics.getEnrollmentAnalytics(query.days);
  }

  @Get("revenue")
  @ApiOperation({ summary: "Revenue analytics" })
  async getRevenueAnalytics(@Query() query: DaysQueryDto) {
    return this.commerceAnalytics.getRevenueAnalytics(query.days);
  }

  @Get("course-performance")
  @ApiOperation({ summary: "Per-course performance (enrollment, completion, quiz, revenue)" })
  async getCoursePerformance() {
    return this.academicAnalytics.getCoursePerformance();
  }

  @Get("mentor-performance")
  @ApiOperation({
    summary: "Per-mentor performance (caseload, student completion, review turnaround)",
  })
  async getMentorPerformance() {
    return this.academicAnalytics.getMentorPerformance();
  }

  @Get("assignments")
  @ApiOperation({ summary: "Assignment analytics" })
  async getAssignmentAnalytics() {
    return this.academicAnalytics.getAssignmentAnalytics();
  }

  @Get("quizzes")
  @ApiOperation({ summary: "Quiz analytics" })
  async getQuizAnalytics() {
    return this.academicAnalytics.getQuizAnalytics();
  }

  @Get("community")
  @ApiOperation({ summary: "Community analytics" })
  async getCommunityAnalytics(@Query() query: DaysQueryDto) {
    return this.engagementAnalytics.getCommunityAnalytics(query.days);
  }

  @Get("notification-delivery")
  @ApiOperation({ summary: "Notification delivery analytics by channel" })
  async getNotificationDeliveryAnalytics() {
    return this.engagementAnalytics.getNotificationDeliveryAnalytics();
  }
}
