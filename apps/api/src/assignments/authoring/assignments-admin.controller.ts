import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { Assignment, AssignmentDetail, PaginatedData, RubricCriterion } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { ChangeStatusDto } from "../dto/change-status.dto";
import { toAssignment, toAssignmentDetail, toRubricCriterion } from "../assignments.mappers";
import { AssignmentsAdminService } from "./assignments-admin.service";
import { CreateAssignmentDto } from "./dto/create-assignment.dto";
import { CreateCriterionDto } from "./dto/create-criterion.dto";
import { ListAssignmentsQueryDto } from "./dto/list-assignments-query.dto";
import { UpdateAssignmentDto } from "./dto/update-assignment.dto";
import { UpdateCriterionDto } from "./dto/update-criterion.dto";

@ApiTags("assignments: admin")
@Controller("admin/assignments")
@RequirePermissions("assignment:manage")
export class AssignmentsAdminController {
  constructor(
    private readonly assignmentsService: AssignmentsAdminService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create an assignment (starts in DRAFT); optionally from a template" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateAssignmentDto,
    @Req() req: Request,
  ): Promise<AssignmentDetail> {
    const assignment = await this.assignmentsService.create(dto, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "assignments.assignment_created",
      entityType: "Assignment",
      entityId: assignment.id,
      after: { title: assignment.title, slug: assignment.slug },
      ...requestAuditMeta(req),
    });
    return toAssignmentDetail(assignment);
  }

  @Get()
  @ApiOperation({ summary: "List assignments (filter by status/subject)" })
  async list(@Query() query: ListAssignmentsQueryDto): Promise<PaginatedData<Assignment>> {
    const { items, total } = await this.assignmentsService.list({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      subjectId: query.subjectId,
    });
    return { items: items.map(toAssignment), page: query.page, pageSize: query.pageSize, total };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an assignment with its rubric criteria" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<AssignmentDetail> {
    return toAssignmentDetail(await this.assignmentsService.findDetailOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an assignment (does not change status)" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssignmentDto,
    @Req() req: Request,
  ): Promise<AssignmentDetail> {
    const before = await this.assignmentsService.findByIdOrThrow(id);
    const updated = await this.assignmentsService.update(id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "assignments.assignment_updated",
      entityType: "Assignment",
      entityId: id,
      before: { title: before.title },
      after: { title: updated.title },
      ...requestAuditMeta(req),
    });
    return toAssignmentDetail(updated);
  }

  @Patch(":id/status")
  @RequirePermissions("assignment:publish")
  @ApiOperation({
    summary: "Change assignment status (publish/unpublish/archive) — assignment:publish",
  })
  async changeStatus(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @Req() req: Request,
  ): Promise<Assignment> {
    const before = await this.assignmentsService.findByIdOrThrow(id);
    const updated = await this.assignmentsService.changeStatus(id, dto.status);
    await this.auditService.record({
      actorId: actor.id,
      action: "assignments.assignment_status_changed",
      entityType: "Assignment",
      entityId: id,
      before: { status: before.status },
      after: { status: updated.status },
      ...requestAuditMeta(req),
    });
    return toAssignment(updated);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete an assignment (must not be PUBLISHED)" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.assignmentsService.remove(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "assignments.assignment_deleted",
      entityType: "Assignment",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }

  @Post(":id/criteria")
  @ApiOperation({ summary: "Add a rubric criterion" })
  async addCriterion(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateCriterionDto,
    @Req() req: Request,
  ): Promise<RubricCriterion> {
    const criterion = await this.assignmentsService.addCriterion(id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "assignments.criterion_added",
      entityType: "RubricCriterion",
      entityId: criterion.id,
      after: { assignmentId: id, title: criterion.title, maxMarks: criterion.maxMarks.toString() },
      ...requestAuditMeta(req),
    });
    return toRubricCriterion(criterion);
  }

  @Patch(":id/criteria/:criterionId")
  @ApiOperation({ summary: "Update a rubric criterion" })
  async updateCriterion(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("criterionId", ParseUUIDPipe) criterionId: string,
    @Body() dto: UpdateCriterionDto,
    @Req() req: Request,
  ): Promise<RubricCriterion> {
    const updated = await this.assignmentsService.updateCriterion(id, criterionId, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "assignments.criterion_updated",
      entityType: "RubricCriterion",
      entityId: criterionId,
      after: { title: updated.title },
      ...requestAuditMeta(req),
    });
    return toRubricCriterion(updated);
  }

  @Delete(":id/criteria/:criterionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a rubric criterion" })
  async removeCriterion(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("criterionId", ParseUUIDPipe) criterionId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.assignmentsService.removeCriterion(id, criterionId);
    await this.auditService.record({
      actorId: actor.id,
      action: "assignments.criterion_removed",
      entityType: "RubricCriterion",
      entityId: criterionId,
      ...requestAuditMeta(req),
    });
  }
}
