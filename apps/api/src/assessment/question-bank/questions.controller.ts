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
import type { PaginatedData, Question } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toQuestion } from "../assessment.mappers";
import { ChangeStatusDto } from "../dto/change-status.dto";
import { BulkCreateQuestionsDto } from "./dto/bulk-create-questions.dto";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { ListQuestionsQueryDto } from "./dto/list-questions-query.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";
import { QuestionsService } from "./questions.service";

@ApiTags("assessment: questions")
@Controller("admin/assessment/questions")
@RequirePermissions("question:manage")
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a question (starts in DRAFT)" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateQuestionDto,
    @Req() req: Request,
  ): Promise<Question> {
    const question = await this.questionsService.create(dto, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.question_created",
      entityType: "Question",
      entityId: question.id,
      after: { type: question.type, text: question.text },
      ...requestAuditMeta(req),
    });
    return toQuestion(question);
  }

  @Post("bulk")
  @ApiOperation({ summary: "Bulk-create questions (import foundation)" })
  async bulkCreate(
    @CurrentUser() actor: RequestUser,
    @Body() dto: BulkCreateQuestionsDto,
    @Req() req: Request,
  ): Promise<{ created: number }> {
    const created = await this.questionsService.bulkCreate(dto.questions, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.questions_bulk_created",
      entityType: "Question",
      after: { count: created.length },
      ...requestAuditMeta(req),
    });
    return { created: created.length };
  }

  @Get()
  @ApiOperation({ summary: "List questions (filter by status/subject/type/difficulty/tag)" })
  async list(@Query() query: ListQuestionsQueryDto): Promise<PaginatedData<Question>> {
    const { items, total } = await this.questionsService.list({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      subjectId: query.subjectId,
      type: query.type,
      difficulty: query.difficulty,
      tag: query.tag,
    });
    return { items: items.map(toQuestion), page: query.page, pageSize: query.pageSize, total };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a question by id" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<Question> {
    return toQuestion(await this.questionsService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a question (does not change status)" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionDto,
    @Req() req: Request,
  ): Promise<Question> {
    const before = await this.questionsService.findByIdOrThrow(id);
    const updated = await this.questionsService.update(id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.question_updated",
      entityType: "Question",
      entityId: id,
      before: { text: before.text },
      after: { text: updated.text },
      ...requestAuditMeta(req),
    });
    return toQuestion(updated);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Change question status (publish/unpublish/archive)" })
  async changeStatus(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @Req() req: Request,
  ): Promise<Question> {
    const before = await this.questionsService.findByIdOrThrow(id);
    const updated = await this.questionsService.changeStatus(id, dto.status);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.question_status_changed",
      entityType: "Question",
      entityId: id,
      before: { status: before.status },
      after: { status: updated.status },
      ...requestAuditMeta(req),
    });
    return toQuestion(updated);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a question (must be unassigned from all quizzes)" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.questionsService.remove(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.question_deleted",
      entityType: "Question",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
