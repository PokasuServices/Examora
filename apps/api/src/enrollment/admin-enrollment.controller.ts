import {
  Body,
  Controller,
  Delete,
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
import type { Enrollment, PaginatedData } from "@examora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../common/request-meta";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/types/request-user";
import { GrantEnrollmentDto } from "./dto/grant-enrollment.dto";
import { ListEnrollmentsQueryDto } from "./dto/list-enrollments-query.dto";
import { toEnrollment } from "./enrollment.mappers";
import { EnrollmentService } from "./enrollment.service";

/** Admin enrollment management (ADR-0018) — manual grant/revoke, cross-student visibility. */
@ApiTags("commerce: enrollment (admin)")
@Controller("admin/enrollments")
@RequirePermissions("commerce:manage")
export class AdminEnrollmentController {
  constructor(
    private readonly enrollmentService: EnrollmentService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List all enrollments (community:manage)" })
  async list(@Query() query: ListEnrollmentsQueryDto): Promise<PaginatedData<Enrollment>> {
    const { items, total } = await this.enrollmentService.listAll({
      page: query.page,
      pageSize: query.pageSize,
      userId: query.userId,
      courseId: query.courseId,
      status: query.status,
    });
    return { items: items.map(toEnrollment), page: query.page, pageSize: query.pageSize, total };
  }

  @Post()
  @ApiOperation({ summary: "Manually grant a course enrollment" })
  async grant(
    @CurrentUser() actor: RequestUser,
    @Body() dto: GrantEnrollmentDto,
    @Req() req: Request,
  ): Promise<Enrollment> {
    const enrollment = await this.enrollmentService.adminGrant(dto.userId, dto.courseId);
    await this.auditService.record({
      actorId: actor.id,
      action: "enrollment.admin_granted",
      entityType: "Enrollment",
      entityId: enrollment.id,
      after: { userId: dto.userId, courseId: dto.courseId },
      ...requestAuditMeta(req),
    });
    return toEnrollment(enrollment);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke an enrollment" })
  async revoke(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.enrollmentService.adminRevoke(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "enrollment.admin_revoked",
      entityType: "Enrollment",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
