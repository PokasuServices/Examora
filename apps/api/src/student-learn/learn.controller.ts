import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import type {
  TopicMarkValue,
  LearnCourseOption,
  LearnCourseOverview,
  LearnLessonCompleteResult,
  LearnLessonDetail,
  LessonPracticeQuestion,
  LearnQuizInfo,
  LearnSubjectDetail,
  LearnTopicDetail,
  TopicRatingValue,
} from "@examora/types";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/types/request-user";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../common/request-meta";
import { ProgressService } from "../learning/progress.service";
import { LessonAnswerDto } from "./dto/lesson-answer.dto";
import { MarkTopicDto } from "./dto/mark-topic.dto";
import { RateTopicDto } from "./dto/rate-topic.dto";
import { LessonQuestionsService } from "./lesson-questions.service";
import { LearnService } from "./learn.service";

/** Student "Learn" section: exam → subjects → topics → lessons and topic quizzes. Licence required. */
@ApiTags("student: learn")
@Controller("learn")
@RequirePermissions("content:read")
export class LearnController {
  constructor(
    private readonly learn: LearnService,
    private readonly progress: ProgressService,
    private readonly auditService: AuditService,
    private readonly lessonQuestions: LessonQuestionsService,
  ) {}

  @Get("courses")
  @ApiOperation({ summary: "Courses I hold an active licence for (the exam picker)" })
  listCourses(@CurrentUser() user: RequestUser): Promise<LearnCourseOption[]> {
    return this.learn.listMyCourses(user.id);
  }

  @Get("courses/:id")
  @ApiOperation({ summary: "Subject cards with progress, plus the syllabus heatmap" })
  getCourse(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<LearnCourseOverview> {
    return this.learn.getCourseOverview(user.id, id);
  }

  @Get("subjects/:id")
  @ApiOperation({ summary: "A subject's topics with progress" })
  getSubject(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<LearnSubjectDetail> {
    return this.learn.getSubject(user.id, id);
  }

  @Get("topics/:id")
  @ApiOperation({ summary: "A topic's lessons and quizzes with my progress" })
  getTopic(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<LearnTopicDetail> {
    return this.learn.getTopic(user.id, id);
  }

  @Put("topics/:id/mark")
  @ApiOperation({ summary: "Mark a topic as favourite and/or on hold (my own labels)" })
  markTopic(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MarkTopicDto,
  ): Promise<TopicMarkValue> {
    return this.learn.markTopic(user.id, id, dto);
  }

  @Put("topics/:id/rating")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Rate my understanding of a topic (1–5)" })
  async rateTopic(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RateTopicDto,
  ): Promise<void> {
    await this.learn.rateTopic(user.id, id, dto.rating as TopicRatingValue);
  }

  @Get("lessons/:id")
  @ApiOperation({ summary: "Lesson content, its XP and my completion" })
  getLesson(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<LearnLessonDetail> {
    return this.learn.getLesson(user.id, id);
  }

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post("lessons/:id/questions/:linkId/answer")
  @ApiOperation({
    summary: "Answer a practice question inside a lesson (once); reveals the explanation",
  })
  async answerLessonQuestion(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("linkId", ParseUUIDPipe) linkId: string,
    @Body() dto: LessonAnswerDto,
  ): Promise<LessonPracticeQuestion> {
    await this.learn.assertLessonLicence(user.id, id);
    return this.lessonQuestions.answer(user.id, id, linkId, dto);
  }

  @Post("lessons/:id/complete")
  @ApiOperation({ summary: "Mark a lesson complete and collect its XP (idempotent)" })
  async completeLesson(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<LearnLessonCompleteResult> {
    await this.learn.assertLessonLicence(user.id, id);
    const result = await this.progress.complete(user.id, id);
    if (!result.alreadyComplete) {
      await this.auditService.record({
        actorId: user.id,
        action: "learning.lesson_completed",
        entityType: "Lesson",
        entityId: id,
        after: { courseId: result.courseId, xpAwarded: result.xpAwarded },
        ...requestAuditMeta(req),
      });
    }
    return { xpAwarded: result.xpAwarded };
  }

  @Get("quizzes/:id")
  @ApiOperation({ summary: "Quiz info page: questions, attempts used/allowed, XP, last report" })
  getQuiz(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<LearnQuizInfo> {
    return this.learn.getQuizInfo(user.id, id);
  }
}
