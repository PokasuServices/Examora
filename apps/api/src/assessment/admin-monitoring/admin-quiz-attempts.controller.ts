import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
  AdminAttemptDetail,
  AdminAttemptSummary,
  PaginatedData,
  QuizResultDashboard,
} from "@examora/types";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { toAdminAttemptDetail, toAdminAttemptSummary } from "../assessment.mappers";
import { AdminQuizAttemptsService } from "./admin-quiz-attempts.service";
import { ListAdminAttemptsQueryDto } from "./dto/list-admin-attempts-query.dto";

/** Read-only attempt monitoring + result dashboard for administrators (quiz:attempts:read). */
@ApiTags("admin: assessment")
@Controller("admin/assessment")
@RequirePermissions("quiz:attempts:read")
export class AdminQuizAttemptsController {
  constructor(private readonly adminAttempts: AdminQuizAttemptsService) {}

  @Get("attempts")
  @ApiOperation({ summary: "List/monitor quiz attempts (filter by quiz/student/status)" })
  async list(
    @Query() query: ListAdminAttemptsQueryDto,
  ): Promise<PaginatedData<AdminAttemptSummary>> {
    const { items, total } = await this.adminAttempts.list({
      page: query.page,
      pageSize: query.pageSize,
      quizId: query.quizId,
      userId: query.userId,
      status: query.status,
    });
    return {
      items: items.map(toAdminAttemptSummary),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  @Get("attempts/:id")
  @ApiOperation({ summary: "Get full detail (with answers) for one attempt" })
  async getDetail(@Param("id", ParseUUIDPipe) id: string): Promise<AdminAttemptDetail> {
    return toAdminAttemptDetail(await this.adminAttempts.findDetailOrThrow(id));
  }

  @Get("quizzes/:quizId/results")
  @ApiOperation({ summary: "Aggregate result dashboard for one quiz" })
  async getResultDashboard(
    @Param("quizId", ParseUUIDPipe) quizId: string,
  ): Promise<QuizResultDashboard> {
    return this.adminAttempts.getResultDashboard(quizId);
  }
}
