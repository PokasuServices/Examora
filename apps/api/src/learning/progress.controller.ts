import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { CourseProgress, LearningDashboard, RecentLesson } from "@examora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../common/request-meta";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/types/request-user";
import { RecentQueryDto } from "./dto/recent-query.dto";
import { ProgressService } from "./progress.service";

/**
 * Student learning actions and dashboards. Every route is self-scoped to the
 * caller (req.user.id) and needs only authentication + content:read — a
 * student can never touch another student's progress (ADR-0013).
 */
@ApiTags("learning")
@Controller("learning")
@RequirePermissions("content:read")
export class ProgressController {
  constructor(
    private readonly progress: ProgressService,
    private readonly auditService: AuditService,
  ) {}

  @Post("lessons/:id/view")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Record that the caller viewed a lesson" })
  async view(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.progress.recordView(user.id, id);
  }

  @Post("lessons/:id/complete")
  @ApiOperation({ summary: "Mark a lesson complete (idempotent)" })
  async complete(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<{ status: string }> {
    const result = await this.progress.complete(user.id, id);
    if (!result.alreadyComplete) {
      await this.auditService.record({
        actorId: user.id,
        action: "learning.lesson_completed",
        entityType: "Lesson",
        entityId: id,
        after: { courseId: result.courseId },
        ...requestAuditMeta(req),
      });
    }
    return { status: "completed" };
  }

  @Get("dashboard")
  @ApiOperation({ summary: "The caller's learning dashboard (continue learning, recent, stats)" })
  dashboard(@CurrentUser() user: RequestUser): Promise<LearningDashboard> {
    return this.progress.getDashboard(user.id);
  }

  @Get("continue")
  @ApiOperation({ summary: "Courses the caller has started but not finished" })
  continueLearning(@CurrentUser() user: RequestUser): Promise<CourseProgress[]> {
    return this.progress.listContinueLearning(user.id);
  }

  @Get("recent")
  @ApiOperation({ summary: "The caller's recently viewed lessons" })
  recent(
    @CurrentUser() user: RequestUser,
    @Query() query: RecentQueryDto,
  ): Promise<RecentLesson[]> {
    return this.progress.listRecentlyViewed(user.id, query.limit);
  }

  @Get("courses/:id/progress")
  @ApiOperation({ summary: "The caller's progress in a specific course" })
  courseProgress(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<CourseProgress> {
    return this.progress.getCourseProgress(user.id, id);
  }
}
