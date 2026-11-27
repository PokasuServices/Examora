import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  REPORT_KIND_LABEL,
  SHOUTOUTS_PER_WEEK,
  SHOUTOUT_BADGES,
  type BatchAnnouncementView,
  type ProgressReportKind,
  type ProgressReportStatus,
  type ProgressReportSummary,
  type ProgressReportView,
  type ShoutoutBadge,
  type ShoutoutView,
} from "@examora/types";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/types/request-user";
import { PrismaService } from "../prisma/prisma.service";
import { StaffScopeService } from "../staff/staff-scope.service";
import { DeskNotifier } from "./desk-notifier.service";
import {
  USER_NAME_SELECT,
  addDays,
  monthRange,
  parseDay,
  person,
  personName,
  todayIndia,
} from "./desk-util";
import { ExcelService } from "./excel.service";
import { InsightsService } from "./insights.service";

const REPORT_INCLUDE = {
  student: { select: USER_NAME_SELECT },
  mentor: { select: USER_NAME_SELECT },
  cohort: { select: { id: true, name: true } },
} as const;

const EMPTY_SUMMARY: ProgressReportSummary = {
  attendancePercent: null,
  classesHeld: 0,
  absences: 0,
  quizzesTaken: 0,
  avgQuizPercent: null,
  dailyQuizDays: 0,
  sketchesMarked: 0,
  avgSketchPercent: null,
  assignmentsSubmitted: 0,
  assignmentsMissing: 0,
  lessonsCompleted: 0,
  weakTopics: [],
};

/** Reports to the admin, mentor shout-out badges and batch announcements. */
@Injectable()
export class EngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: StaffScopeService,
    private readonly insights: InsightsService,
    private readonly notify: DeskNotifier,
    private readonly audit: AuditService,
    private readonly excel: ExcelService,
  ) {}

  // ------------------------------------------------------------ reports

  private view(r: {
    id: string;
    kind: string;
    period: string;
    status: string;
    summary: unknown;
    remarks: string;
    adminNote: string | null;
    submittedAt: Date | null;
    decidedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    student: { id: string; email: string; firstName: string | null; lastName: string | null };
    mentor: { id: string; email: string; firstName: string | null; lastName: string | null };
    cohort: { id: string; name: string } | null;
  }): ProgressReportView {
    return {
      id: r.id,
      kind: r.kind as ProgressReportKind,
      period: r.period,
      status: r.status as ProgressReportStatus,
      student: person(r.student),
      cohort: r.cohort,
      mentor: person(r.mentor),
      summary: { ...EMPTY_SUMMARY, ...((r.summary as Partial<ProgressReportSummary>) ?? {}) },
      remarks: r.remarks,
      adminNote: r.adminNote,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private periodRange(kind: ProgressReportKind, period: string) {
    if (kind === "MONTHLY" && /^\d{4}-\d{2}$/.test(period)) return monthRange(period);
    const to = /^\d{4}-\d{2}-\d{2}$/.test(period) ? parseDay(period) : todayIndia();
    return { from: addDays(to, -30), to };
  }

  async summaryFor(
    studentId: string,
    kind: ProgressReportKind,
    period: string,
  ): Promise<ProgressReportSummary> {
    const { from, to } = this.periodRange(kind, period);
    const courses = await this.prisma.cohortMember.findMany({
      where: { userId: studentId, cohort: { courseId: { not: null } } },
      select: { cohort: { select: { courseId: true } } },
    });
    const stats = await this.insights.stats(
      [studentId],
      from,
      to,
      courses.map((c) => c.cohort.courseId!),
    );
    const s = stats.get(studentId);
    if (!s) return EMPTY_SUMMARY;
    const { userId: _u, lastActiveAt: _l, lastThreeAbsent: _a, ...summary } = s;
    return summary;
  }

  async listReports(
    actor: RequestUser,
    q: { status?: string; studentId?: string; kind?: string; period?: string },
  ): Promise<ProgressReportView[]> {
    const mentorOnly = this.scope.isScoped(actor);
    const rows = await this.prisma.progressReport.findMany({
      where: {
        ...(mentorOnly ? { mentorId: actor.id } : { status: q.status ?? { not: "DRAFT" } }),
        ...(mentorOnly && q.status ? { status: q.status } : {}),
        ...(q.studentId ? { studentId: q.studentId } : {}),
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.period ? { period: q.period } : {}),
      },
      include: REPORT_INCLUDE,
      orderBy: [{ updatedAt: "desc" }],
      take: 300,
    });
    return rows.map((r) => this.view(r));
  }

  async getReport(actor: RequestUser, id: string): Promise<ProgressReportView> {
    const r = await this.prisma.progressReport.findUnique({
      where: { id },
      include: REPORT_INCLUDE,
    });
    if (!r) throw new NotFoundException("Report not found");
    if (this.scope.isScoped(actor) && r.mentorId !== actor.id)
      throw new NotFoundException("Report not found");
    return this.view(r);
  }

  async createReport(
    actor: RequestUser,
    input: { studentId: string; kind: ProgressReportKind; period?: string; remarks?: string },
  ): Promise<ProgressReportView> {
    await this.scope.assert(actor, "student", input.studentId);
    const period =
      input.period ??
      (input.kind === "MONTHLY"
        ? new Date().toISOString().slice(0, 7)
        : new Date().toISOString().slice(0, 10));
    if (input.kind === "MONTHLY") {
      const existing = await this.prisma.progressReport.findFirst({
        where: { studentId: input.studentId, mentorId: actor.id, kind: "MONTHLY", period },
        include: REPORT_INCLUDE,
      });
      if (existing) return this.view(existing);
    }
    const s = await this.scope.scopeFor(actor);
    const cohort = await this.prisma.cohortMember.findFirst({
      where: { userId: input.studentId, ...(s ? { cohortId: { in: s.cohortIds } } : {}) },
      select: { cohortId: true },
    });
    const row = await this.prisma.progressReport.create({
      data: {
        studentId: input.studentId,
        mentorId: actor.id,
        cohortId: cohort?.cohortId ?? null,
        kind: input.kind,
        period,
        summary: (await this.summaryFor(input.studentId, input.kind, period)) as object,
        remarks: input.remarks?.trim() ?? "",
      },
      include: REPORT_INCLUDE,
    });
    return this.view(row);
  }

  /** Monthly report-card drafts for every student in my batches (skips ones already started). */
  async prepareMonth(actor: RequestUser, month: string): Promise<{ created: number }> {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException("Use a month like 2026-11");
    const s = await this.scope.mentorScope(actor.id);
    let created = 0;
    for (const studentId of s.studentIds) {
      const exists = await this.prisma.progressReport.count({
        where: { studentId, mentorId: actor.id, kind: "MONTHLY", period: month },
      });
      if (exists) continue;
      await this.createReport(actor, { studentId, kind: "MONTHLY", period: month });
      created++;
    }
    return { created };
  }

  private async ownEditable(actor: RequestUser, id: string) {
    const r = await this.prisma.progressReport.findUnique({ where: { id } });
    if (!r || r.mentorId !== actor.id) throw new NotFoundException("Report not found");
    if (r.status !== "DRAFT" && r.status !== "RETURNED") {
      throw new BadRequestException("This report is with the admin and can't be edited now");
    }
    return r;
  }

  async updateReport(
    actor: RequestUser,
    id: string,
    input: { remarks?: string; refresh?: boolean },
  ) {
    const r = await this.ownEditable(actor, id);
    const row = await this.prisma.progressReport.update({
      where: { id },
      data: {
        ...(input.remarks !== undefined ? { remarks: input.remarks.trim() } : {}),
        ...(input.refresh
          ? {
              summary: (await this.summaryFor(
                r.studentId,
                r.kind as ProgressReportKind,
                r.period,
              )) as object,
            }
          : {}),
      },
      include: REPORT_INCLUDE,
    });
    return this.view(row);
  }

  async submitReport(actor: RequestUser, id: string): Promise<ProgressReportView> {
    const r = await this.ownEditable(actor, id);
    if (r.remarks.trim().length < 10)
      throw new BadRequestException("Add your remarks (at least a sentence) before sending");
    const row = await this.prisma.progressReport.update({
      where: { id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        adminNote: null,
        summary: (await this.summaryFor(
          r.studentId,
          r.kind as ProgressReportKind,
          r.period,
        )) as object,
      },
      include: REPORT_INCLUDE,
    });
    await this.notify.admins(
      "staff.report_submitted",
      `${REPORT_KIND_LABEL[row.kind as ProgressReportKind]}: ${personName(row.student)}`,
      `${personName(row.mentor)} sent a report for approval.`,
      { reportId: id, url: "/student-reports" },
    );
    return this.view(row);
  }

  async decideReport(
    actor: RequestUser,
    id: string,
    approve: boolean,
    note?: string,
  ): Promise<ProgressReportView> {
    const r = await this.prisma.progressReport.findUnique({ where: { id } });
    if (!r) throw new NotFoundException("Report not found");
    if (r.status !== "SUBMITTED")
      throw new BadRequestException("Only reports waiting for approval can be decided");
    if (!approve && !note?.trim())
      throw new BadRequestException("Say what to change so the mentor can fix it");
    const row = await this.prisma.progressReport.update({
      where: { id },
      data: {
        status: approve ? "APPROVED" : "RETURNED",
        decidedAt: new Date(),
        decidedById: actor.id,
        adminNote: note?.trim() || null,
      },
      include: REPORT_INCLUDE,
    });
    await this.audit.record({
      actorId: actor.id,
      action: approve ? "report.approved" : "report.returned",
      entityType: "ProgressReport",
      entityId: id,
      after: { status: row.status },
    });
    await this.notify.user(
      r.mentorId,
      approve ? "staff.report_approved" : "staff.report_returned",
      `${approve ? "Approved" : "Sent back"}: report for ${personName(row.student)}`,
      approve ? `An administrator approved it.${note ? ` ${note}` : ""}` : `Please revise: ${note}`,
      { reportId: id, url: "/student-reports" },
    );
    return this.view(row);
  }

  /** Approved reports log for the admin (download only: the numbers are calculated). */
  async exportReports(q: { status?: string; period?: string }) {
    const rows = await this.prisma.progressReport.findMany({
      where: { status: q.status ?? "APPROVED", ...(q.period ? { period: q.period } : {}) },
      include: REPORT_INCLUDE,
      orderBy: [{ period: "desc" }, { decidedAt: "desc" }],
    });
    const views = rows.map((r) => this.view(r));
    const buffer = await this.excel.build([
      {
        name: "Reports",
        title: `Mentor reports · ${q.status ?? "APPROVED"}${q.period ? ` · ${q.period}` : ""}`,
        columns: [
          { key: "period", header: "Period", width: 10 },
          { key: "kind", header: "Type", width: 24 },
          { key: "student", header: "Student", width: 22 },
          { key: "email", header: "Email", width: 28 },
          { key: "batch", header: "Batch", width: 26 },
          { key: "mentor", header: "Mentor", width: 18 },
          { key: "attendance", header: "Attendance %", width: 12 },
          { key: "quizAvg", header: "Quiz avg %", width: 11 },
          { key: "daily", header: "Daily quiz days", width: 14 },
          { key: "lessons", header: "Lessons done", width: 12 },
          { key: "missing", header: "Assignments missed", width: 17 },
          { key: "weak", header: "Weak topics", width: 30 },
          { key: "remarks", header: "Mentor remarks", width: 60 },
          { key: "adminNote", header: "Admin note", width: 30 },
          { key: "status", header: "Status", width: 11 },
        ],
        rows: views.map((v) => ({
          period: v.period,
          kind: REPORT_KIND_LABEL[v.kind],
          student: v.student.name,
          email: v.student.email,
          batch: v.cohort?.name ?? "",
          mentor: v.mentor.name,
          attendance: v.summary.attendancePercent ?? "",
          quizAvg: v.summary.avgQuizPercent ?? "",
          daily: v.summary.dailyQuizDays,
          lessons: v.summary.lessonsCompleted,
          missing: v.summary.assignmentsMissing,
          weak: v.summary.weakTopics.join(", "),
          remarks: v.remarks,
          adminNote: v.adminNote ?? "",
          status: v.status,
        })),
      },
    ]);
    return { buffer, fileName: `Mentor reports ${q.period ?? "all"}.xlsx` };
  }

  // ------------------------------------------------------------ shout-outs

  private shoutView(r: {
    id: string;
    badge: string;
    note: string | null;
    createdAt: Date;
    student: { id: string; email: string; firstName: string | null; lastName: string | null };
    mentor: { id: string; email: string; firstName: string | null; lastName: string | null };
  }): ShoutoutView {
    const b = SHOUTOUT_BADGES.find((x) => x.key === r.badge) ?? SHOUTOUT_BADGES[0];
    return {
      id: r.id,
      badge: b.key,
      label: b.label,
      icon: b.icon,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      student: person(r.student),
      mentor: { id: r.mentor.id, name: personName(r.mentor) },
    };
  }

  async shoutouts(actor: RequestUser): Promise<{ given: ShoutoutView[]; left: number }> {
    const rows = await this.prisma.mentorShoutout.findMany({
      where: this.scope.isScoped(actor) ? { mentorId: actor.id } : {},
      include: { student: { select: USER_NAME_SELECT }, mentor: { select: USER_NAME_SELECT } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const week = await this.prisma.mentorShoutout.count({
      where: { mentorId: actor.id, createdAt: { gte: addDays(new Date(), -7) } },
    });
    return {
      given: rows.map((r) => this.shoutView(r)),
      left: Math.max(0, SHOUTOUTS_PER_WEEK - week),
    };
  }

  async giveShoutout(
    actor: RequestUser,
    input: { studentId: string; badge: ShoutoutBadge; note?: string },
  ): Promise<ShoutoutView> {
    await this.scope.assert(actor, "student", input.studentId);
    const badge = SHOUTOUT_BADGES.find((b) => b.key === input.badge);
    if (!badge) throw new BadRequestException("Pick a badge");
    const week = await this.prisma.mentorShoutout.count({
      where: { mentorId: actor.id, createdAt: { gte: addDays(new Date(), -7) } },
    });
    if (week >= SHOUTOUTS_PER_WEEK) {
      throw new ForbiddenException(
        `You've given ${SHOUTOUTS_PER_WEEK} shout-outs this week. Keep them special!`,
      );
    }
    const row = await this.prisma.mentorShoutout.create({
      data: {
        studentId: input.studentId,
        mentorId: actor.id,
        badge: badge.key,
        note: input.note?.trim() || null,
      },
      include: { student: { select: USER_NAME_SELECT }, mentor: { select: USER_NAME_SELECT } },
    });
    await this.notify.user(
      input.studentId,
      "student.shoutout",
      `🎉 ${badge.label}`,
      `${personName(row.mentor)} gave you a shout-out${row.note ? `: ${row.note}` : "!"}`,
      { url: "/rewards" },
    );
    return this.shoutView(row);
  }

  async myShoutouts(userId: string): Promise<ShoutoutView[]> {
    const rows = await this.prisma.mentorShoutout.findMany({
      where: { studentId: userId },
      include: { student: { select: USER_NAME_SELECT }, mentor: { select: USER_NAME_SELECT } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map((r) => this.shoutView(r));
  }

  // ------------------------------------------------------------ announcements

  private annView(r: {
    id: string;
    cohortId: string;
    title: string;
    body: string;
    linkUrl: string | null;
    createdAt: Date;
    cohort: { name: string };
    author: { id: string; email: string; firstName: string | null; lastName: string | null };
  }): BatchAnnouncementView {
    return {
      id: r.id,
      cohortId: r.cohortId,
      cohortName: r.cohort.name,
      title: r.title,
      body: r.body,
      linkUrl: r.linkUrl,
      createdAt: r.createdAt.toISOString(),
      author: { id: r.author.id, name: personName(r.author) },
    };
  }

  async announcements(actor: RequestUser, cohortId?: string): Promise<BatchAnnouncementView[]> {
    const s = await this.scope.scopeFor(actor);
    if (cohortId) await this.scope.assert(actor, "cohort", cohortId);
    const rows = await this.prisma.batchAnnouncement.findMany({
      where: cohortId ? { cohortId } : s ? { cohortId: { in: s.cohortIds } } : {},
      include: { cohort: { select: { name: true } }, author: { select: USER_NAME_SELECT } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((r) => this.annView(r));
  }

  async announce(
    actor: RequestUser,
    input: { cohortIds: string[]; title: string; body: string; linkUrl?: string | null },
  ): Promise<BatchAnnouncementView[]> {
    if (input.cohortIds.length === 0) throw new BadRequestException("Choose at least one batch");
    for (const id of input.cohortIds) await this.scope.assert(actor, "cohort", id);
    const out: BatchAnnouncementView[] = [];
    for (const cohortId of input.cohortIds) {
      const row = await this.prisma.batchAnnouncement.create({
        data: {
          cohortId,
          authorId: actor.id,
          title: input.title.trim(),
          body: input.body.trim(),
          linkUrl: input.linkUrl?.trim() || null,
        },
        include: { cohort: { select: { name: true } }, author: { select: USER_NAME_SELECT } },
      });
      out.push(this.annView(row));
      const members = await this.prisma.cohortMember.findMany({
        where: { cohortId },
        select: { userId: true },
      });
      for (const m of members) {
        await this.notify.user(
          m.userId,
          "student.batch_announcement",
          `📣 ${row.title}`,
          row.body.slice(0, 160),
          {
            announcementId: row.id,
            url: input.linkUrl?.trim() || "/learn",
          },
        );
      }
    }
    return out;
  }

  async myAnnouncements(userId: string): Promise<BatchAnnouncementView[]> {
    const rows = await this.prisma.batchAnnouncement.findMany({
      where: { cohort: { members: { some: { userId } } } },
      include: { cohort: { select: { name: true } }, author: { select: USER_NAME_SELECT } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return rows.map((r) => this.annView(r));
  }
}
