import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type {
  AttendanceGrid,
  AttendanceOverviewRow,
  BatchAnnouncementView,
  BatchProgressView,
  ClassSessionView,
  DailyCalendarView,
  DailyScheduleItem,
  DuplicateMatch,
  ImportPreview,
  ImportResult,
  MentorDoubtItem,
  MentorDoubtThread,
  MentorTodayView,
  MentorWorkloadView,
  MyAttendanceView,
  ProgressReportView,
  ReviewInbox,
  SessionRoster,
  ShoutoutView,
  StaffRequestView,
} from "@examora/types";
import type { RequestUser } from "../auth/types/request-user";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PermissionsService } from "../permissions/permissions.service";
import { ActorScope } from "../staff/scope-where";
import { Scoped } from "../staff/scoped.decorator";
import type { StaffScope } from "../staff/staff-scope.service";
import { AttendanceService } from "./attendance.service";
import { DeskService } from "./desk.service";
import { parseDay } from "./desk-util";
import {
  AddSessionDto,
  AnnouncementDto,
  CalendarQueryDto,
  CreateReportDto,
  DailyScheduleDto,
  DecisionDto,
  DoubtReplyDto,
  DoubtsQueryDto,
  DryRunQueryDto,
  DuplicateCheckDto,
  ExportQueryDto,
  MarkAttendanceDto,
  MonthDto,
  NewStudentDto,
  OverviewQueryDto,
  PendingContentDto,
  PoolQueryDto,
  PublishRequestDto,
  QuestionImportQueryDto,
  QuizBatchesDto,
  RangeQueryDto,
  RejectDto,
  ReportsQueryDto,
  RescheduleDto,
  ResolveDto,
  ShoutoutDto,
  StaffRequestsQueryDto,
  UpdateReportDto,
  UpdateSessionDto,
  UploadDto,
} from "./dto";
import { EngagementService } from "./engagement.service";
import { ExcelService } from "./excel.service";
import { QuizToolsService } from "./quiz-tools.service";
import { StaffRequestsService } from "./staff-requests.service";

/** The mentor's workspace: today, attendance, reviews, doubts, tests, reports, badges, notices. */
@ApiTags("mentor desk")
@Controller("mentor-desk")
@RequirePermissions("mentor:workflow")
@Scoped(
  ["cohort", "query:cohortId"],
  ["cohort", "body:cohortId"],
  ["course", "query:courseId"],
  ["course", "body:courseId"],
)
export class MentorDeskController {
  constructor(
    private readonly desk: DeskService,
    private readonly attendance: AttendanceService,
    private readonly tools: QuizToolsService,
    private readonly engagement: EngagementService,
    private readonly excel: ExcelService,
  ) {}

  @Get("today")
  @ApiOperation({
    summary:
      "Mentor home: classes, attendance to mark, reviews, doubts, quiz gaps, students at risk",
  })
  today(@CurrentUser() user: RequestUser): Promise<MentorTodayView> {
    return this.desk.today(user);
  }

  @Get("at-risk")
  async atRisk(@CurrentUser() user: RequestUser) {
    return this.desk.atRisk(await this.desk.deskScope(user));
  }

  @Get("workload")
  workload(@CurrentUser() user: RequestUser): Promise<MentorWorkloadView> {
    return this.desk.workload(user.id);
  }

  @Get("batches/:id/progress")
  @Scoped(["cohort", "params:id"])
  progress(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BatchProgressView> {
    return this.desk.batchProgress(user, id);
  }

  // ------------------------------------------------------------ attendance

  @Get("attendance/sessions")
  sessions(
    @ActorScope() scope: StaffScope | null,
    @Query() q: RangeQueryDto,
  ): Promise<ClassSessionView[]> {
    return this.attendance.listSessions(scope, q);
  }

  @Post("attendance/sessions")
  @ApiOperation({ summary: "Add an extra class" })
  addSession(
    @CurrentUser() user: RequestUser,
    @Body() dto: AddSessionDto,
  ): Promise<ClassSessionView> {
    return this.attendance.addSession(user, dto);
  }

  @Get("attendance/sessions/:id")
  roster(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SessionRoster> {
    return this.attendance.roster(user, id);
  }

  @Put("attendance/sessions/:id")
  @ApiOperation({ summary: "Mark attendance for a class" })
  mark(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MarkAttendanceDto,
  ): Promise<SessionRoster> {
    return this.attendance.mark(user, id, dto);
  }

  @Patch("attendance/sessions/:id")
  @ApiOperation({ summary: "Cancel / restore a class or set its topic" })
  updateSession(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessionDto,
  ): Promise<ClassSessionView> {
    return this.attendance.updateSession(user, id, dto);
  }

  @Get("attendance/grid")
  grid(@Query() q: RangeQueryDto): Promise<AttendanceGrid> {
    return this.attendance.grid(q.cohortId!, parseDay(q.from), parseDay(q.to));
  }

  @Get("attendance/overview")
  overview(
    @ActorScope() scope: StaffScope | null,
    @Query() q: OverviewQueryDto,
  ): Promise<AttendanceOverviewRow[]> {
    return this.attendance.overview(scope, q);
  }

  @Get("attendance/export")
  @ApiOperation({ summary: "Attendance sheet (.xlsx) for a batch: daily, weekly or monthly" })
  async exportAttendance(@Query() q: ExportQueryDto, @Res() res: Response) {
    const { buffer, fileName } = await this.attendance.exportFile(
      q.cohortId,
      q.period,
      q.date,
      false,
    );
    this.excel.send(res, fileName, buffer);
  }

  @Get("attendance/template")
  @ApiOperation({ summary: "Same sheet with the students and classes filled and marks blank" })
  async attendanceTemplate(@Query() q: ExportQueryDto, @Res() res: Response) {
    const { buffer, fileName } = await this.attendance.exportFile(
      q.cohortId,
      q.period,
      q.date,
      true,
    );
    this.excel.send(res, fileName, buffer);
  }

  @Post("attendance/import/:cohortId")
  @Scoped(["cohort", "params:cohortId"])
  importAttendance(
    @CurrentUser() user: RequestUser,
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
    @Query() q: DryRunQueryDto,
    @Body() dto: UploadDto,
  ): Promise<ImportPreview | ImportResult> {
    return this.attendance.importFile(user, cohortId, dto.contentBase64, q.dryRun === "true");
  }

  // ------------------------------------------------------------ reviews & doubts

  @Get("reviews")
  reviews(@CurrentUser() user: RequestUser): Promise<ReviewInbox> {
    return this.desk.reviews(user);
  }

  @Get("doubts")
  doubts(@CurrentUser() user: RequestUser, @Query() q: DoubtsQueryDto): Promise<MentorDoubtItem[]> {
    return this.desk.doubts(user, q);
  }

  @Get("doubts/:id")
  doubt(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<MentorDoubtThread> {
    return this.desk.doubt(user, id);
  }

  @Post("doubts/:id/reply")
  reply(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DoubtReplyDto,
  ): Promise<MentorDoubtThread> {
    return this.desk.replyDoubt(user, id, dto.body, dto.resolve ?? false);
  }

  @Put("doubts/:id/resolved")
  resolve(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ResolveDto,
  ): Promise<MentorDoubtThread> {
    return this.desk.resolveDoubt(user, id, dto.resolved);
  }

  // ------------------------------------------------------------ daily quiz calendar

  @Get("daily")
  calendar(
    @CurrentUser() user: RequestUser,
    @Query() q: CalendarQueryDto,
  ): Promise<DailyCalendarView> {
    return this.tools.calendar(user, q.courseId, q.from, q.to);
  }

  @Get("daily/pool")
  pool(@CurrentUser() user: RequestUser, @Query() q: PoolQueryDto) {
    return this.tools.dailyPool(user, q.courseId, q.search);
  }

  @Post("daily")
  @ApiOperation({
    summary: "Put a daily quiz on the course calendar (a taken day moves to the next free one)",
  })
  schedule(
    @CurrentUser() user: RequestUser,
    @Body() dto: DailyScheduleDto,
  ): Promise<DailyScheduleItem> {
    return this.tools.schedule(user, dto);
  }

  @Patch("daily/:id")
  reschedule(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RescheduleDto,
  ): Promise<DailyScheduleItem> {
    return this.tools.reschedule(user, id, dto);
  }

  // ------------------------------------------------------------ tests & questions

  @Get("quizzes/:id/batches")
  @Scoped(["quiz", "params:id"])
  quizBatches(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.tools.quizBatches(user, id);
  }

  @Put("quizzes/:id/batches")
  @Scoped(["quiz", "params:id"])
  @ApiOperation({ summary: "Publish a quiz to batches (none = the whole course)" })
  setQuizBatches(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: QuizBatchesDto,
  ) {
    return this.tools.setQuizBatches(user, id, dto.cohortIds);
  }

  @Post("questions/duplicates")
  @ApiOperation({ summary: "Similar questions that already exist (warns, never blocks)" })
  duplicates(
    @ActorScope() scope: StaffScope | null,
    @Body() dto: DuplicateCheckDto,
  ): Promise<DuplicateMatch[]> {
    return this.tools.duplicates(scope, dto);
  }

  @Get("questions/template")
  async questionTemplate(@Res() res: Response) {
    this.excel.send(res, "Examora questions template.xlsx", await this.tools.questionTemplate());
  }

  @Get("quizzes/:id/questions/export")
  @Scoped(["quiz", "params:id"])
  async exportQuestions(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.tools.exportQuizQuestions(user, id);
    this.excel.send(res, fileName, buffer);
  }

  @Post("questions/import")
  @Scoped(["quiz", "query:quizId"])
  importQuestions(
    @CurrentUser() user: RequestUser,
    @Query() q: QuestionImportQueryDto,
    @Body() dto: UploadDto,
  ): Promise<ImportPreview | ImportResult> {
    return this.tools.importQuestions(
      user,
      { quizId: q.quizId, courseId: q.courseId },
      dto.contentBase64,
      q.dryRun === "true",
    );
  }

  @Get("quizzes/:id/marks/export")
  @Scoped(["quiz", "params:id"])
  async exportMarks(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.tools.marksSheet(user, id, false);
    this.excel.send(res, fileName, buffer);
  }

  @Get("quizzes/:id/marks/template")
  @Scoped(["quiz", "params:id"])
  async marksTemplate(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.tools.marksSheet(user, id, true);
    this.excel.send(res, fileName, buffer);
  }

  @Post("quizzes/:id/marks/import")
  @Scoped(["quiz", "params:id"])
  importMarks(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: DryRunQueryDto,
    @Body() dto: UploadDto,
  ): Promise<ImportPreview | ImportResult> {
    return this.tools.importMarks(user, id, dto.contentBase64, q.dryRun === "true");
  }

  // ------------------------------------------------------------ reports

  @Get("reports")
  reports(
    @CurrentUser() user: RequestUser,
    @Query() q: ReportsQueryDto,
  ): Promise<ProgressReportView[]> {
    return this.engagement.listReports(user, q);
  }

  @Get("reports/:id")
  report(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ProgressReportView> {
    return this.engagement.getReport(user, id);
  }

  @Post("reports")
  @Scoped(["student", "body:studentId"])
  createReport(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateReportDto,
  ): Promise<ProgressReportView> {
    return this.engagement.createReport(user, dto);
  }

  @Post("reports/prepare-month")
  @ApiOperation({ summary: "Monthly report-card drafts for every student in my batches" })
  prepareMonth(@CurrentUser() user: RequestUser, @Body() dto: MonthDto) {
    return this.engagement.prepareMonth(user, dto.month);
  }

  @Patch("reports/:id")
  updateReport(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportDto,
  ): Promise<ProgressReportView> {
    return this.engagement.updateReport(user, id, dto);
  }

  @Post("reports/:id/submit")
  submitReport(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ProgressReportView> {
    return this.engagement.submitReport(user, id);
  }

  // ------------------------------------------------------------ shout-outs & announcements

  @Get("shoutouts")
  shoutouts(@CurrentUser() user: RequestUser) {
    return this.engagement.shoutouts(user);
  }

  @Post("shoutouts")
  @Scoped(["student", "body:studentId"])
  giveShoutout(@CurrentUser() user: RequestUser, @Body() dto: ShoutoutDto): Promise<ShoutoutView> {
    return this.engagement.giveShoutout(user, dto);
  }

  @Get("announcements")
  announcements(
    @CurrentUser() user: RequestUser,
    @Query("cohortId") cohortId?: string,
  ): Promise<BatchAnnouncementView[]> {
    return this.engagement.announcements(user, cohortId);
  }

  @Post("announcements")
  @Scoped(["cohort", "body:cohortIds"])
  announce(
    @CurrentUser() user: RequestUser,
    @Body() dto: AnnouncementDto,
  ): Promise<BatchAnnouncementView[]> {
    return this.engagement.announce(user, dto);
  }
}

/** Mentors ask; administrators decide (publish requests, content changes, new students, reports). */
@ApiTags("staff requests")
@Controller("staff-requests")
export class StaffRequestsController {
  constructor(
    private readonly requests: StaffRequestsService,
    private readonly engagement: EngagementService,
    private readonly excel: ExcelService,
    private readonly permissions: PermissionsService,
  ) {}

  @Post("publish")
  @RequirePermissions("deletion:request")
  publish(
    @CurrentUser() user: RequestUser,
    @Body() dto: PublishRequestDto,
  ): Promise<StaffRequestView> {
    return this.requests.requestPublish(user, dto.targetType, dto.targetId, dto.note);
  }

  @Post("new-student")
  @RequirePermissions("deletion:request")
  @Scoped(["cohort", "body:cohortId"])
  newStudent(
    @CurrentUser() user: RequestUser,
    @Body() dto: NewStudentDto,
  ): Promise<StaffRequestView> {
    return this.requests.requestStudent(user, dto);
  }

  @Post("pending-content")
  @RequirePermissions("content:read")
  pendingContent(@Body() dto: PendingContentDto) {
    return this.requests.pendingContent(dto.ids);
  }

  @Get("mine")
  @RequirePermissions("deletion:request")
  mine(@CurrentUser() user: RequestUser): Promise<StaffRequestView[]> {
    return this.requests.listMine(user.id);
  }

  @Get()
  @RequirePermissions("deletion:review")
  list(@Query() q: StaffRequestsQueryDto): Promise<StaffRequestView[]> {
    return this.requests.list(q.status, q.kind);
  }

  @Post(":id/approve")
  @RequirePermissions("deletion:review")
  approve(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
  ): Promise<StaffRequestView> {
    return this.requests.approve(user, id, dto.note);
  }

  @Post(":id/reject")
  @RequirePermissions("deletion:review")
  reject(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectDto,
  ): Promise<StaffRequestView> {
    return this.requests.reject(user, id, dto.note);
  }

  // ---- reports approval (admin dashboard)

  @Post("reports/:id/approve")
  @RequirePermissions("deletion:review")
  approveReport(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
  ): Promise<ProgressReportView> {
    return this.engagement.decideReport(user, id, true, dto.note);
  }

  @Post("reports/:id/return")
  @RequirePermissions("deletion:review")
  returnReport(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectDto,
  ): Promise<ProgressReportView> {
    return this.engagement.decideReport(user, id, false, dto.note);
  }

  @Get("reports/export")
  @RequirePermissions("deletion:review")
  async exportReports(@Query() q: ReportsQueryDto, @Res() res: Response) {
    const { buffer, fileName } = await this.engagement.exportReports(q);
    this.excel.send(res, fileName, buffer);
  }

  // ---- batch members Excel (admin adds; a mentor's rows become requests)

  @Get("batches/:id/members/export")
  @RequirePermissions("batches:read")
  @Scoped(["cohort", "params:id"])
  async exportMembers(@Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    const rows = await this.requests.membersRows(id);
    const buffer = await this.excel.build([
      {
        name: "Students",
        columns: StaffRequestsService.MEMBER_COLUMNS,
        rows,
        instructions: MEMBER_HELP,
      },
    ]);
    this.excel.send(res, "Batch students.xlsx", buffer);
  }

  @Get("batches/members/template")
  @RequirePermissions("batches:read")
  async membersTemplate(@Res() res: Response) {
    const buffer = await this.excel.build([
      {
        name: "Students",
        columns: StaffRequestsService.MEMBER_COLUMNS,
        rows: [],
        blankRows: 100,
        instructions: MEMBER_HELP,
      },
    ]);
    this.excel.send(res, "Batch students template.xlsx", buffer);
  }

  @Post("batches/:id/members/import")
  @RequirePermissions("batches:read")
  @Scoped(["cohort", "params:id"])
  async importMembers(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: DryRunQueryDto,
    @Body() dto: UploadDto,
  ): Promise<ImportPreview | ImportResult> {
    const granted = await this.permissions.getPermissionsForRoles(user.roles);
    const canManage = granted.includes("batches:manage");
    const rows = await this.excel.read(dto.contentBase64, StaffRequestsService.MEMBER_COLUMNS);
    const r = await this.requests.importMembers(user, id, rows, q.dryRun === "true", canManage);
    if (q.dryRun === "true") {
      return {
        ok: r.valid,
        issues: r.issues,
        warnings: r.warnings,
        columns: StaffRequestsService.MEMBER_COLUMNS.map((c) => c.header),
        sample: rows.slice(0, 8).map((x) => ({
          Name: x.name ?? "",
          Email: x.email ?? "",
          Phone: x.phone ?? "",
          "Parent phone": x.guardianPhone ?? "",
        })),
      };
    }
    const failed = rows.filter((x) => r.issues.some((i) => i.row === Number(x.__row)));
    return {
      imported: r.added ?? 0,
      skipped: failed.length,
      issues: r.issues,
      requests: r.requests ?? 0,
      errorFile: await this.excel.errorFile(
        "Students",
        StaffRequestsService.MEMBER_COLUMNS,
        failed.map((x) => ({
          values: x,
          message: r.issues
            .filter((i) => i.row === Number(x.__row))
            .map((i) => i.message)
            .join("; "),
        })),
      ),
    };
  }
}

const MEMBER_HELP = [
  "One student per row: Name and Email are required.",
  "Administrators: existing students are added to the batch; new emails get a student account (they set a password with “Forgot password”).",
  "Mentors: each row is sent to an administrator, who adds the student.",
];

/** Admin oversight of mentors. */
@ApiTags("mentor desk")
@Controller("mentor-desk/admin")
@RequirePermissions("mentor:manage")
export class MentorOversightController {
  constructor(private readonly desk: DeskService) {}

  @Get("performance")
  performance(): Promise<MentorWorkloadView[]> {
    return this.desk.performance();
  }
}

/** What the mentor module shows a student: attendance, shout-outs, batch notices. */
@ApiTags("me")
@Controller("me")
@RequirePermissions("profile:read:own")
export class StudentDeskController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly engagement: EngagementService,
  ) {}

  @Get("attendance")
  myAttendance(@CurrentUser() user: RequestUser): Promise<MyAttendanceView> {
    return this.attendance.myAttendance(user.id);
  }

  @Get("shoutouts")
  myShoutouts(@CurrentUser() user: RequestUser): Promise<ShoutoutView[]> {
    return this.engagement.myShoutouts(user.id);
  }

  @Get("announcements")
  myAnnouncements(@CurrentUser() user: RequestUser): Promise<BatchAnnouncementView[]> {
    return this.engagement.myAnnouncements(user.id);
  }
}
