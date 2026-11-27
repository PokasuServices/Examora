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
import type { BulkLicenceResult, Enrollment, PaginatedData } from "@examora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../common/request-meta";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/types/request-user";
import { BulkLicenceDto } from "./dto/bulk-licence.dto";
import { GrantEnrollmentDto } from "./dto/grant-enrollment.dto";
import { ListEnrollmentsQueryDto } from "./dto/list-enrollments-query.dto";
import { toEnrollment } from "./enrollment.mappers";
import { EnrollmentService } from "./enrollment.service";
import { ProtectedDelete } from "../common/decorators/protected-delete.decorator";

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

  @Post("bulk-grant")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Assign course licences to all students or selected students" })
  async bulkGrant(
    @CurrentUser() actor: RequestUser,
    @Body() dto: BulkLicenceDto,
    @Req() req: Request,
  ): Promise<BulkLicenceResult> {
    const result = await this.enrollmentService.adminBulkGrant(dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "enrollment.admin_bulk_granted",
      entityType: "Enrollment",
      after: { ...result, courseIds: dto.courseIds, allStudents: Boolean(dto.allStudents) },
      ...requestAuditMeta(req),
    });
    return result;
  }

  @Post("bulk-revoke")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove course licences from all students or selected students" })
  async bulkRevoke(
    @CurrentUser() actor: RequestUser,
    @Body() dto: BulkLicenceDto,
    @Req() req: Request,
  ): Promise<BulkLicenceResult> {
    const result = await this.enrollmentService.adminBulkRevoke(dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "enrollment.admin_bulk_revoked",
      entityType: "Enrollment",
      after: { ...result, courseIds: dto.courseIds, allStudents: Boolean(dto.allStudents) },
      ...requestAuditMeta(req),
    });
    return result;
  }

  @Delete(":id")
  @ProtectedDelete(null)
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
