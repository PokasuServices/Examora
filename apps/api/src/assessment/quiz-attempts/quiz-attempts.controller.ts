import {
  Body,
  Controller,
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
import type {
  AttemptHistoryItem,
  AttemptResult,
  AttemptReview,
  AttemptState,
  PaginatedData,
} from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import {
  toAttemptHistoryItem,
  toAttemptResult,
  toAttemptReview,
  toAttemptState,
} from "../assessment.mappers";
import { AutosaveAnswerDto } from "./dto/autosave-answer.dto";
import { ListAttemptHistoryQueryDto } from "./dto/list-attempt-history-query.dto";
import { StartAttemptDto } from "./dto/start-attempt.dto";
import { QuizAttemptsService } from "./quiz-attempts.service";

@ApiTags("assessment: quiz attempts")
@Controller("quiz-attempts")
@RequirePermissions("quiz:read")
export class QuizAttemptsController {
  constructor(
    private readonly attemptsService: QuizAttemptsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Start a new attempt, or resume an existing in-progress one" })
  async start(
    @CurrentUser() actor: RequestUser,
    @Body() dto: StartAttemptDto,
    @Req() req: Request,
  ): Promise<AttemptState> {
    const { attempt, created } = await this.attemptsService.start(dto.quizId, actor.id);
    if (created) {
      await this.auditService.record({
        actorId: actor.id,
        action: "assessment.quiz_attempt_started",
        entityType: "QuizAttempt",
        entityId: attempt.id,
        after: { quizId: dto.quizId },
        ...requestAuditMeta(req),
      });
    }
    return toAttemptState(await this.attemptsService.getAttemptState(attempt.id, actor.id));
  }

  @Get()
  @ApiOperation({ summary: "List the caller's attempt history (optionally filtered by quiz)" })
  async history(
    @CurrentUser() actor: RequestUser,
    @Query() query: ListAttemptHistoryQueryDto,
  ): Promise<PaginatedData<AttemptHistoryItem>> {
    const { items, total } = await this.attemptsService.listHistory(actor.id, {
      page: query.page,
      pageSize: query.pageSize,
      quizId: query.quizId,
    });
    return {
      items: items.map(toAttemptHistoryItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get the current state of an attempt (resume) — auto-finalizes if expired",
  })
  async getState(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<AttemptState> {
    return toAttemptState(await this.attemptsService.getAttemptState(id, actor.id));
  }

  @Patch(":id/answers")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Autosave a single answer" })
  async autosave(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AutosaveAnswerDto,
  ): Promise<void> {
    await this.attemptsService.autosaveAnswer(id, actor.id, dto.questionId, dto.selectedOptionIds);
  }

  @Post(":id/submit")
  @ApiOperation({ summary: "Submit an attempt (idempotent — safe to call more than once)" })
  async submit(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<AttemptResult> {
    const { attempt, justSubmitted } = await this.attemptsService.submit(id, actor.id);
    if (justSubmitted) {
      await this.auditService.record({
        actorId: actor.id,
        action: "assessment.quiz_attempt_submitted",
        entityType: "QuizAttempt",
        entityId: attempt.id,
        after: { percentage: attempt.percentage?.toString(), passed: attempt.passed },
        ...requestAuditMeta(req),
      });
    }
    const { quizTitle } = await this.attemptsService.getResult(id, actor.id);
    return toAttemptResult({ attempt, quizTitle });
  }

  @Get(":id/result")
  @ApiOperation({ summary: "Get the result summary of a finalized attempt" })
  async getResult(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<AttemptResult> {
    return toAttemptResult(await this.attemptsService.getResult(id, actor.id));
  }

  @Get(":id/review")
  @ApiOperation({ summary: "Get the detailed per-question review of a finalized attempt" })
  async getReview(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<AttemptReview> {
    return toAttemptReview(await this.attemptsService.getReview(id, actor.id));
  }
}
