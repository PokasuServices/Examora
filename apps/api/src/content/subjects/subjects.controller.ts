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
import type { PaginatedData, Subject } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { ChangeStatusDto } from "../courses/dto/change-status.dto";
import { ReorderDto } from "../dto/reorder.dto";
import { toSubject } from "../content.mappers";
import { CreateSubjectDto } from "./dto/create-subject.dto";
import { ListSubjectsQueryDto } from "./dto/list-subjects-query.dto";
import { SubjectsService } from "./subjects.service";
import { UpdateSubjectDto } from "./dto/update-subject.dto";

@ApiTags("content: subjects")
@Controller("admin/content/subjects")
@RequirePermissions("content:manage")
export class SubjectsController {
  constructor(
    private readonly subjectsService: SubjectsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a subject under a course" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateSubjectDto,
    @Req() req: Request,
  ): Promise<Subject> {
    const subject = await this.subjectsService.create(dto, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.subject_created",
      entityType: "Subject",
      entityId: subject.id,
      after: { courseId: subject.courseId, title: subject.title, slug: subject.slug },
      ...requestAuditMeta(req),
    });
    return toSubject(subject);
  }

  @Get()
  @ApiOperation({ summary: "List subjects in a course" })
  async list(@Query() query: ListSubjectsQueryDto): Promise<PaginatedData<Subject>> {
    const { items, total } = await this.subjectsService.list({
      courseId: query.courseId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });
    return { items: items.map(toSubject), page: query.page, pageSize: query.pageSize, total };
  }

  @Post("reorder")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Reorder subjects by an ordered id list" })
  async reorder(
    @CurrentUser() actor: RequestUser,
    @Body() dto: ReorderDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.subjectsService.reorder(dto.orderedIds);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.subjects_reordered",
      entityType: "Subject",
      after: { orderedIds: dto.orderedIds },
      ...requestAuditMeta(req),
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a subject by id" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<Subject> {
    return toSubject(await this.subjectsService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a subject" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectDto,
    @Req() req: Request,
  ): Promise<Subject> {
    const before = await this.subjectsService.findByIdOrThrow(id);
    const updated = await this.subjectsService.update(id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.subject_updated",
      entityType: "Subject",
      entityId: id,
      before: { title: before.title, slug: before.slug },
      after: { title: updated.title, slug: updated.slug },
      ...requestAuditMeta(req),
    });
    return toSubject(updated);
  }

  @Patch(":id/status")
  @RequirePermissions("content:publish")
  @ApiOperation({ summary: "Change subject status — content:publish" })
  async changeStatus(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @Req() req: Request,
  ): Promise<Subject> {
    const before = await this.subjectsService.findByIdOrThrow(id);
    const updated = await this.subjectsService.changeStatus(id, dto.status);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.subject_status_changed",
      entityType: "Subject",
      entityId: id,
      before: { status: before.status },
      after: { status: updated.status },
      ...requestAuditMeta(req),
    });
    return toSubject(updated);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a subject" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.subjectsService.remove(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.subject_deleted",
      entityType: "Subject",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
