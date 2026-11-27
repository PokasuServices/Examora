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
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { Course, PaginatedData, PastPaperStatRow } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toCourse } from "../content.mappers";
import { ReorderDto } from "../dto/reorder.dto";
import { CoursesService } from "./courses.service";
import { ChangeStatusDto } from "./dto/change-status.dto";
import { CreateCourseDto } from "./dto/create-course.dto";
import { ListCoursesQueryDto } from "./dto/list-courses-query.dto";
import { ReplacePastPaperStatsDto } from "./dto/replace-past-paper-stats.dto";
import { UpdateCourseDto } from "./dto/update-course.dto";
import { ProtectedDelete } from "../../common/decorators/protected-delete.decorator";
import { Scoped } from "../../staff/scoped.decorator";
import { ActorScope, scopeWhere } from "../../staff/scope-where";
import type { StaffScope } from "../../staff/staff-scope.service";

@ApiTags("content: courses")
@Controller("admin/content/courses")
@Scoped(["course", "params:id"])
@RequirePermissions("content:manage")
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @RequirePermissions("courses:manage")
  @ApiOperation({ summary: "Create a course (starts in DRAFT)" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateCourseDto,
    @Req() req: Request,
  ): Promise<Course> {
    const course = await this.coursesService.create(dto, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.course_created",
      entityType: "Course",
      entityId: course.id,
      after: { title: course.title, slug: course.slug },
      ...requestAuditMeta(req),
    });
    return toCourse(course);
  }

  @Get()
  @ApiOperation({ summary: "List courses (filter by status/category/examType)" })
  async list(
    @ActorScope() actorScope: StaffScope | null,
    @Query() query: ListCoursesQueryDto,
  ): Promise<PaginatedData<Course>> {
    const { items, total } = await this.coursesService.list({
      scope: scopeWhere.course(actorScope),
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      categoryId: query.categoryId,
      examType: query.examType,
    });
    return { items: items.map(toCourse), page: query.page, pageSize: query.pageSize, total };
  }

  @Post("reorder")
  @RequirePermissions("courses:manage")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Reorder courses by an ordered id list" })
  async reorder(
    @CurrentUser() actor: RequestUser,
    @Body() dto: ReorderDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.coursesService.reorder(dto.orderedIds);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.courses_reordered",
      entityType: "Course",
      after: { orderedIds: dto.orderedIds },
      ...requestAuditMeta(req),
    });
  }

  @Get(":id/past-paper-stats")
  @ApiOperation({ summary: "Syllabus heatmap rows: questions per subject per past-paper year" })
  getPastPaperStats(@Param("id", ParseUUIDPipe) id: string): Promise<PastPaperStatRow[]> {
    return this.coursesService.getPastPaperStats(id);
  }

  @Put(":id/past-paper-stats")
  @RequirePermissions("courses:manage")
  @ApiOperation({ summary: "Replace the course's syllabus heatmap rows" })
  async replacePastPaperStats(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReplacePastPaperStatsDto,
    @Req() req: Request,
  ): Promise<PastPaperStatRow[]> {
    const rows = await this.coursesService.replacePastPaperStats(id, dto.rows);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.course_past_paper_stats_replaced",
      entityType: "Course",
      entityId: id,
      after: { rows: rows.length },
      ...requestAuditMeta(req),
    });
    return rows;
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a course by id" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<Course> {
    return toCourse(await this.coursesService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @RequirePermissions("courses:manage")
  @ApiOperation({ summary: "Update a course (does not change status)" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
    @Req() req: Request,
  ): Promise<Course> {
    const before = await this.coursesService.findByIdOrThrow(id);
    const updated = await this.coursesService.update(id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.course_updated",
      entityType: "Course",
      entityId: id,
      before: { title: before.title, slug: before.slug },
      after: { title: updated.title, slug: updated.slug },
      ...requestAuditMeta(req),
    });
    return toCourse(updated);
  }

  @Patch(":id/status")
  @RequirePermissions("content:publish")
  @ApiOperation({ summary: "Change course status (publish/unpublish/archive) — content:publish" })
  async changeStatus(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @Req() req: Request,
  ): Promise<Course> {
    const before = await this.coursesService.findByIdOrThrow(id);
    const updated = await this.coursesService.changeStatus(id, dto.status);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.course_status_changed",
      entityType: "Course",
      entityId: id,
      before: { status: before.status },
      after: { status: updated.status },
      ...requestAuditMeta(req),
    });
    return toCourse(updated);
  }

  @Delete(":id")
  @ProtectedDelete("course")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a course (must not be PUBLISHED)" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.coursesService.remove(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.course_deleted",
      entityType: "Course",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
