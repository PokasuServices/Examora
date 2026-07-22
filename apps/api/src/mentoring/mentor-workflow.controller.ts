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
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { MentorFeedback, MentorMeeting, MentorNote, MentorTask } from "@examora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../common/request-meta";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/types/request-user";
import { CreateFeedbackDto } from "./feedback/dto/create-feedback.dto";
import { MentorFeedbackService } from "./feedback/mentor-feedback.service";
import { CreateMeetingDto } from "./meetings/dto/create-meeting.dto";
import { MentorMeetingsService } from "./meetings/mentor-meetings.service";
import { toMentorFeedback, toMentorMeeting, toMentorNote, toMentorTask } from "./mentoring.mappers";
import { CreateNoteDto } from "./notes/dto/create-note.dto";
import { UpdateNoteDto } from "./notes/dto/update-note.dto";
import { MentorNotesService } from "./notes/mentor-notes.service";
import { CreateTaskDto } from "./tasks/dto/create-task.dto";
import { UpdateTaskDto } from "./tasks/dto/update-task.dto";
import { MentorTasksService } from "./tasks/mentor-tasks.service";

/**
 * Notes/tasks/feedback/meetings for one student, gated by `mentor:workflow`
 * (ADMINISTRATOR holds every code, so admin oversight passes this gate too;
 * ownership — actor is the student's assigned mentor, or an admin — is
 * enforced inside each service, ADR-0016).
 */
@ApiTags("mentoring: workflow")
@Controller("students/:studentId")
@RequirePermissions("mentor:workflow")
export class MentorWorkflowController {
  constructor(
    private readonly notesService: MentorNotesService,
    private readonly tasksService: MentorTasksService,
    private readonly feedbackService: MentorFeedbackService,
    private readonly meetingsService: MentorMeetingsService,
    private readonly auditService: AuditService,
  ) {}

  @Get("notes")
  @ApiOperation({ summary: "List private mentor notes for a student" })
  async listNotes(
    @CurrentUser() actor: RequestUser,
    @Param("studentId", ParseUUIDPipe) studentId: string,
  ): Promise<MentorNote[]> {
    return (await this.notesService.list(actor, studentId)).map(toMentorNote);
  }

  @Post("notes")
  @ApiOperation({ summary: "Add a private mentor note for a student" })
  async createNote(
    @CurrentUser() actor: RequestUser,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Body() dto: CreateNoteDto,
    @Req() req: Request,
  ): Promise<MentorNote> {
    const note = await this.notesService.create(actor, studentId, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "mentoring.note_created",
      entityType: "MentorNote",
      entityId: note.id,
      after: { studentId },
      ...requestAuditMeta(req),
    });
    return toMentorNote(note);
  }

  @Patch("notes/:noteId")
  @ApiOperation({ summary: "Update a mentor note" })
  async updateNote(
    @CurrentUser() actor: RequestUser,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Param("noteId", ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateNoteDto,
    @Req() req: Request,
  ): Promise<MentorNote> {
    const note = await this.notesService.update(actor, studentId, noteId, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "mentoring.note_updated",
      entityType: "MentorNote",
      entityId: noteId,
      ...requestAuditMeta(req),
    });
    return toMentorNote(note);
  }

  @Delete("notes/:noteId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a mentor note" })
  async removeNote(
    @CurrentUser() actor: RequestUser,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Param("noteId", ParseUUIDPipe) noteId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.notesService.remove(actor, studentId, noteId);
    await this.auditService.record({
      actorId: actor.id,
      action: "mentoring.note_deleted",
      entityType: "MentorNote",
      entityId: noteId,
      ...requestAuditMeta(req),
    });
  }

  @Get("tasks")
  @ApiOperation({ summary: "List tasks assigned to a student" })
  async listTasks(
    @CurrentUser() actor: RequestUser,
    @Param("studentId", ParseUUIDPipe) studentId: string,
  ): Promise<MentorTask[]> {
    return (await this.tasksService.list(actor, studentId)).map(toMentorTask);
  }

  @Post("tasks")
  @ApiOperation({ summary: "Assign a task to a student" })
  async createTask(
    @CurrentUser() actor: RequestUser,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Body() dto: CreateTaskDto,
    @Req() req: Request,
  ): Promise<MentorTask> {
    const task = await this.tasksService.create(actor, studentId, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "mentoring.task_created",
      entityType: "MentorTask",
      entityId: task.id,
      after: { studentId, title: task.title },
      ...requestAuditMeta(req),
    });
    return toMentorTask(task);
  }

  @Patch("tasks/:taskId")
  @ApiOperation({ summary: "Update a task (details or status)" })
  async updateTask(
    @CurrentUser() actor: RequestUser,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: Request,
  ): Promise<MentorTask> {
    const task = await this.tasksService.update(actor, studentId, taskId, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "mentoring.task_updated",
      entityType: "MentorTask",
      entityId: taskId,
      after: { status: task.status },
      ...requestAuditMeta(req),
    });
    return toMentorTask(task);
  }

  @Delete("tasks/:taskId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a task" })
  async removeTask(
    @CurrentUser() actor: RequestUser,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.tasksService.remove(actor, studentId, taskId);
    await this.auditService.record({
      actorId: actor.id,
      action: "mentoring.task_deleted",
      entityType: "MentorTask",
      entityId: taskId,
      ...requestAuditMeta(req),
    });
  }

  @Get("feedback")
  @ApiOperation({ summary: "List feedback shared with a student" })
  async listFeedback(
    @CurrentUser() actor: RequestUser,
    @Param("studentId", ParseUUIDPipe) studentId: string,
  ): Promise<MentorFeedback[]> {
    return (await this.feedbackService.list(actor, studentId)).map(toMentorFeedback);
  }

  @Post("feedback")
  @ApiOperation({ summary: "Share feedback with a student" })
  async createFeedback(
    @CurrentUser() actor: RequestUser,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Body() dto: CreateFeedbackDto,
    @Req() req: Request,
  ): Promise<MentorFeedback> {
    const feedback = await this.feedbackService.create(actor, studentId, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "mentoring.feedback_created",
      entityType: "MentorFeedback",
      entityId: feedback.id,
      after: { studentId },
      ...requestAuditMeta(req),
    });
    return toMentorFeedback(feedback);
  }

  @Get("meetings")
  @ApiOperation({ summary: "List logged meetings with a student" })
  async listMeetings(
    @CurrentUser() actor: RequestUser,
    @Param("studentId", ParseUUIDPipe) studentId: string,
  ): Promise<MentorMeeting[]> {
    return (await this.meetingsService.list(actor, studentId)).map(toMentorMeeting);
  }

  @Post("meetings")
  @ApiOperation({ summary: "Log a 1:1 meeting with a student" })
  async createMeeting(
    @CurrentUser() actor: RequestUser,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Body() dto: CreateMeetingDto,
    @Req() req: Request,
  ): Promise<MentorMeeting> {
    const meeting = await this.meetingsService.create(actor, studentId, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "mentoring.meeting_logged",
      entityType: "MentorMeeting",
      entityId: meeting.id,
      after: { studentId, occurredAt: dto.occurredAt },
      ...requestAuditMeta(req),
    });
    return toMentorMeeting(meeting);
  }
}
