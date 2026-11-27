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
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AdminLessonQuestion } from "@examora/types";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AttachLessonQuestionDto } from "./dto/lesson-answer.dto";
import { LessonQuestionsService } from "./lesson-questions.service";
import { Scoped } from "../staff/scoped.decorator";

/** Admin: pick question-bank questions to show inside a lesson. */
@ApiTags("admin: lesson questions")
@Controller("admin/content/lessons/:lessonId/questions")
@Scoped(["lesson", "params:lessonId"], ["question", "body:questionId"])
@RequirePermissions("content:manage")
export class AdminLessonQuestionsController {
  constructor(private readonly lessonQuestions: LessonQuestionsService) {}

  @Get()
  @ApiOperation({ summary: "Questions shown inside this lesson" })
  list(@Param("lessonId", ParseUUIDPipe) lessonId: string): Promise<AdminLessonQuestion[]> {
    return this.lessonQuestions.adminList(lessonId);
  }

  @Post()
  @ApiOperation({ summary: "Add a question-bank question to this lesson" })
  attach(
    @Param("lessonId", ParseUUIDPipe) lessonId: string,
    @Body() dto: AttachLessonQuestionDto,
  ): Promise<AdminLessonQuestion[]> {
    return this.lessonQuestions.adminAttach(lessonId, dto.questionId);
  }

  @Delete(":linkId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a question from this lesson" })
  detach(
    @Param("lessonId", ParseUUIDPipe) lessonId: string,
    @Param("linkId", ParseUUIDPipe) linkId: string,
  ): Promise<void> {
    return this.lessonQuestions.adminDetach(lessonId, linkId);
  }
}
