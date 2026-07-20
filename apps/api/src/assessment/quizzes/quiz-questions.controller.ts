import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { QuizQuestionAssignment } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { ReorderDto } from "../../content/dto/reorder.dto";
import { toQuizQuestionAssignment } from "../assessment.mappers";
import { AssignQuestionDto } from "./dto/assign-question.dto";
import { UpdateQuizQuestionDto } from "./dto/update-quiz-question.dto";
import { QuizQuestionsService } from "./quiz-questions.service";

@ApiTags("assessment: quiz question assignment")
@Controller("admin/assessment/quizzes/:quizId/questions")
@RequirePermissions("quiz:manage")
export class QuizQuestionsController {
  constructor(
    private readonly quizQuestionsService: QuizQuestionsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Assign a PUBLISHED question to this quiz" })
  async assign(
    @CurrentUser() actor: RequestUser,
    @Param("quizId", ParseUUIDPipe) quizId: string,
    @Body() dto: AssignQuestionDto,
    @Req() req: Request,
  ): Promise<QuizQuestionAssignment> {
    const assignment = await this.quizQuestionsService.assign(quizId, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.quiz_question_assigned",
      entityType: "QuizQuestion",
      entityId: assignment.id,
      after: { quizId, questionId: dto.questionId, marks: assignment.marks.toString() },
      ...requestAuditMeta(req),
    });
    return toQuizQuestionAssignment(assignment);
  }

  @Post("reorder")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Reorder a quiz's assigned questions" })
  async reorder(
    @CurrentUser() actor: RequestUser,
    @Param("quizId", ParseUUIDPipe) quizId: string,
    @Body() dto: ReorderDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.quizQuestionsService.reorder(quizId, dto.orderedIds);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.quiz_questions_reordered",
      entityType: "QuizQuestion",
      after: { quizId, orderedIds: dto.orderedIds },
      ...requestAuditMeta(req),
    });
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an assignment's section/marks/position" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("quizId", ParseUUIDPipe) quizId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuizQuestionDto,
    @Req() req: Request,
  ): Promise<QuizQuestionAssignment> {
    const updated = await this.quizQuestionsService.update(quizId, id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.quiz_question_updated",
      entityType: "QuizQuestion",
      entityId: id,
      after: { marks: updated.marks.toString(), sectionId: updated.sectionId },
      ...requestAuditMeta(req),
    });
    return toQuizQuestionAssignment(updated);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Unassign a question from this quiz" })
  async unassign(
    @CurrentUser() actor: RequestUser,
    @Param("quizId", ParseUUIDPipe) quizId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.quizQuestionsService.unassign(quizId, id);
    await this.auditService.record({
      actorId: actor.id,
      action: "assessment.quiz_question_unassigned",
      entityType: "QuizQuestion",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
