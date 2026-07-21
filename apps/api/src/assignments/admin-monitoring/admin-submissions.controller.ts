import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { AdminSubmissionDetail, AdminSubmissionSummary, PaginatedData } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toAdminSubmissionDetail, toAdminSubmissionSummary } from "../assignments.mappers";
import { AdminSubmissionsService } from "./admin-submissions.service";
import { AssignReviewerDto } from "./dto/assign-reviewer.dto";
import { ListAdminSubmissionsQueryDto } from "./dto/list-admin-submissions-query.dto";

@ApiTags("assignments: admin monitoring")
@Controller("admin/assignments/submissions")
@RequirePermissions("assignment:manage")
export class AdminSubmissionsController {
  constructor(
    private readonly adminSubmissionsService: AdminSubmissionsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List/monitor submissions (filter by assignment/reviewer/status)" })
  async list(
    @Query() query: ListAdminSubmissionsQueryDto,
  ): Promise<PaginatedData<AdminSubmissionSummary>> {
    const { items, total } = await this.adminSubmissionsService.list({
      page: query.page,
      pageSize: query.pageSize,
      assignmentId: query.assignmentId,
      reviewerId: query.reviewerId,
      status: query.status,
    });
    return {
      items: items.map(toAdminSubmissionSummary),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get full submission detail (admin — sees everything regardless of status)",
  })
  async getDetail(@Param("id", ParseUUIDPipe) id: string): Promise<AdminSubmissionDetail> {
    return toAdminSubmissionDetail(await this.adminSubmissionsService.findDetailOrThrow(id));
  }

  @Patch(":id/reviewer")
  @ApiOperation({ summary: "Assign or reassign the reviewer for a submission" })
  async assignReviewer(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AssignReviewerDto,
    @Req() req: Request,
  ): Promise<AdminSubmissionSummary> {
    const updated = await this.adminSubmissionsService.assignReviewer(id, dto.reviewerId);
    await this.auditService.record({
      actorId: actor.id,
      action: "assignments.reviewer_assigned",
      entityType: "AssignmentSubmission",
      entityId: id,
      after: { reviewerId: dto.reviewerId },
      ...requestAuditMeta(req),
    });
    return toAdminSubmissionSummary(updated);
  }
}
