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
import type { PaginatedData, Quiz, QuizDetail } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toQuiz, toQuizDetail } from "../assessment.mappers";
import { ChangeStatusDto } from "../dto/change-status.dto";
import { CreateQuizDto } from "./dto/create-quiz.dto";
import { ListQuizzesQueryDto } from "./dto/list-quizzes-query.dto";
import { UpdateQuizDto } from "./dto/update-quiz.dto";
import { QuizzesService } from "./quizzes.service";

@ApiTags("assessment: quizzes")
@Controller("admin/assessment/quizzes")
@RequirePermissions("quiz:manage")
export class QuizzesController {
  constructor(
    private readonly quizzesService: QuizzesService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a quiz (starts in DRAFT)" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateQuizDto,
    @Req() req: Request,
  ): Promise<Quiz> {
    const quiz = await this.quizzesService.create(dto, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.quiz_created",
      entityType: "Quiz",
      entityId: quiz.id,
      after: { title: quiz.title, slug: quiz.slug },
      ...requestAuditMeta(req),
    });
    return toQuiz(quiz);
  }

  @Get()
  @ApiOperation({ summary: "List quizzes (filter by status/subject)" })
  async list(@Query() query: ListQuizzesQueryDto): Promise<PaginatedData<Quiz>> {
    const { items, total } = await this.quizzesService.list({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      subjectId: query.subjectId,
    });
    return { items: items.map(toQuiz), page: query.page, pageSize: query.pageSize, total };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a quiz with its sections and assigned questions" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<QuizDetail> {
    return toQuizDetail(await this.quizzesService.findDetailOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a quiz (does not change status)" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuizDto,
    @Req() req: Request,
  ): Promise<Quiz> {
    const before = await this.quizzesService.findByIdOrThrow(id);
    const updated = await this.quizzesService.update(id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.quiz_updated",
      entityType: "Quiz",
      entityId: id,
      before: { title: before.title },
      after: { title: updated.title },
      ...requestAuditMeta(req),
    });
    return toQuiz(updated);
  }

  @Patch(":id/status")
  @RequirePermissions("quiz:publish")
  @ApiOperation({ summary: "Change quiz status (publish/unpublish/archive) — quiz:publish" })
  async changeStatus(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @Req() req: Request,
  ): Promise<Quiz> {
    const before = await this.quizzesService.findByIdOrThrow(id);
    const updated = await this.quizzesService.changeStatus(id, dto.status);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.quiz_status_changed",
      entityType: "Quiz",
      entityId: id,
      before: { status: before.status },
      after: { status: updated.status },
      ...requestAuditMeta(req),
    });
    return toQuiz(updated);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a quiz (must not be PUBLISHED)" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.quizzesService.remove(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.quiz_deleted",
      entityType: "Quiz",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
