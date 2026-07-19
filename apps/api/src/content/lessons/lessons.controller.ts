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
import type { Lesson, PaginatedData } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { ChangeStatusDto } from "../courses/dto/change-status.dto";
import { ReorderDto } from "../dto/reorder.dto";
import { toLesson } from "../content.mappers";
import { CreateLessonDto } from "./dto/create-lesson.dto";
import { ListLessonsQueryDto } from "./dto/list-lessons-query.dto";
import { LessonsService } from "./lessons.service";
import { UpdateLessonDto } from "./dto/update-lesson.dto";

@ApiTags("content: lessons")
@Controller("admin/content/lessons")
@RequirePermissions("content:manage")
export class LessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a lesson under a module" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateLessonDto,
    @Req() req: Request,
  ): Promise<Lesson> {
    const created = await this.lessonsService.create(dto, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.lesson_created",
      entityType: "Lesson",
      entityId: created.id,
      after: { moduleId: created.moduleId, title: created.title, contentType: created.contentType },
      ...requestAuditMeta(req),
    });
    return toLesson(created);
  }

  @Get()
  @ApiOperation({ summary: "List lessons in a module" })
  async list(@Query() query: ListLessonsQueryDto): Promise<PaginatedData<Lesson>> {
    const { items, total } = await this.lessonsService.list({
      moduleId: query.moduleId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });
    return { items: items.map(toLesson), page: query.page, pageSize: query.pageSize, total };
  }

  @Post("reorder")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Reorder lessons by an ordered id list" })
  async reorder(
    @CurrentUser() actor: RequestUser,
    @Body() dto: ReorderDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.lessonsService.reorder(dto.orderedIds);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.lessons_reordered",
      entityType: "Lesson",
      after: { orderedIds: dto.orderedIds },
      ...requestAuditMeta(req),
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a lesson by id" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<Lesson> {
    return toLesson(await this.lessonsService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a lesson" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateLessonDto,
    @Req() req: Request,
  ): Promise<Lesson> {
    const before = await this.lessonsService.findByIdOrThrow(id);
    const updated = await this.lessonsService.update(id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.lesson_updated",
      entityType: "Lesson",
      entityId: id,
      before: { title: before.title, slug: before.slug },
      after: { title: updated.title, slug: updated.slug },
      ...requestAuditMeta(req),
    });
    return toLesson(updated);
  }

  @Patch(":id/status")
  @RequirePermissions("content:publish")
  @ApiOperation({ summary: "Change lesson status — content:publish" })
  async changeStatus(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @Req() req: Request,
  ): Promise<Lesson> {
    const before = await this.lessonsService.findByIdOrThrow(id);
    const updated = await this.lessonsService.changeStatus(id, dto.status);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.lesson_status_changed",
      entityType: "Lesson",
      entityId: id,
      before: { status: before.status },
      after: { status: updated.status },
      ...requestAuditMeta(req),
    });
    return toLesson(updated);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a lesson" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.lessonsService.remove(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.lesson_deleted",
      entityType: "Lesson",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
