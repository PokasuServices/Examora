import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  DASHBOARD_SEEN_KEYS,
  type CollegesDashboard,
  type DashboardSeenKey,
  type DiscussDashboard,
  type PracticeDashboardSummary,
  type RewardsDashboard,
  type StudentAlertsSync,
} from "@examora/types";
import type { RequestUser } from "../auth/types/request-user";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { StudentAlertsService } from "./student-alerts.service";
import { StudentDashboardsService } from "./student-dashboards.service";

@ApiTags("student: tab dashboards")
@Controller("student-dashboards")
@RequirePermissions("quiz:read")
export class StudentDashboardsController {
  constructor(
    private readonly dashboards: StudentDashboardsService,
    private readonly alerts: StudentAlertsService,
  ) {}

  @Get("practice")
  @ApiOperation({ summary: "My Part B (sketching) status for the Practice tab" })
  practice(@CurrentUser() user: RequestUser): Promise<PracticeDashboardSummary> {
    return this.dashboards.practice(user.id);
  }

  @Get("discuss")
  @ApiOperation({ summary: "My Discuss overview: replies to my posts, likes, popular this week" })
  discuss(@CurrentUser() user: RequestUser): Promise<DiscussDashboard> {
    return this.dashboards.discuss(user.id);
  }

  @Get("colleges")
  @ApiOperation({ summary: "My shortlist, registered webinars and enquiries" })
  colleges(@CurrentUser() user: RequestUser): Promise<CollegesDashboard> {
    return this.dashboards.colleges(user.id);
  }

  @Get("rewards")
  @ApiOperation({ summary: "My XP totals and where they came from" })
  rewards(@CurrentUser() user: RequestUser): Promise<RewardsDashboard> {
    return this.dashboards.rewards(user.id);
  }

  @Post(":key/seen")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Mark a tab as seen (practice, discuss, colleges, rewards)" })
  async seen(@CurrentUser() user: RequestUser, @Param("key") key: string): Promise<void> {
    if (!(DASHBOARD_SEEN_KEYS as readonly string[]).includes(key)) {
      throw new BadRequestException("Unknown tab");
    }
    await this.dashboards.markSeen(user.id, key as DashboardSeenKey);
  }

  @Post("alerts/sync")
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: "Create my pending bell alerts (deadlines, reviews, replies, streak…)" })
  syncAlerts(@CurrentUser() user: RequestUser): Promise<StudentAlertsSync> {
    return this.alerts.sync(user.id);
  }
}
