import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ATTENDANCE_STATUSES,
  attendedStatus,
  type AttendanceGrid,
  type AttendanceMarkInput,
  type AttendanceOverviewRow,
  type AttendancePeriod,
  type AttendanceStatus,
  type ClassSessionView,
  type ImportPreview,
  type ImportResult,
  type MyAttendanceView,
  type SessionRoster,
} from "@examora/types";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/request-user";
import { StaffScopeService, type StaffScope } from "../staff/staff-scope.service";
import { ExcelService, type SheetColumn } from "./excel.service";
import {
  DAY_NAMES,
  USER_NAME_SELECT,
  addDays,
  isoDay,
  monthRange,
  parseDay,
  pct,
  personName,
  todayIndia,
  toMinutes,
  weekStart,
} from "./desk-util";

type Slot = { day: number; start: string; end: string };

const LETTER: Record<AttendanceStatus, string> = {
  PRESENT: "P",
  ABSENT: "A",
  LATE: "L",
  EXCUSED: "E",
};
const FROM_LETTER: Record<string, AttendanceStatus> = {
  P: "PRESENT",
  PRESENT: "PRESENT",
  A: "ABSENT",
  ABSENT: "ABSENT",
  L: "LATE",
  LATE: "LATE",
  E: "EXCUSED",
  EXCUSED: "EXCUSED",
};
const CLASS_HEADER = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/;
/** How far ahead class rows are created from the timetable. */
const AHEAD_DAYS = 14;

const SESSION_INCLUDE = {
  cohort: {
    select: {
      name: true,
      course: { select: { title: true } },
      _count: { select: { members: true } },
    },
  },
  takenBy: { select: USER_NAME_SELECT },
  records: { select: { status: true } },
} as const;

/**
 * Attendance (mentor module): classes come from each batch's timetable (India
 * time) and are marked Present / Absent / Late / Excused by the batch mentor.
 * Percent = (present + late) / classes held, leaving out excused classes.
 */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: StaffScopeService,
    private readonly excel: ExcelService,
  ) {}

  // ------------------------------------------------------------ sessions

  /** Creates the timetable's classes for a date range (idempotent). */
  async ensureSessions(cohortId: string, from: Date, to: Date): Promise<void> {
    const c = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { schedule: true, startsOn: true, endsOn: true, mode: true, isActive: true },
    });
    if (!c || !c.isActive) return;
    const slots = (Array.isArray(c.schedule) ? c.schedule : []) as Slot[];
    if (slots.length === 0) return;
    const last = addDays(todayIndia(), AHEAD_DAYS);
    const start = c.startsOn && c.startsOn > from ? c.startsOn : from;
    let end = to < last ? to : last;
    if (c.endsOn && c.endsOn < end) end = c.endsOn;
    const data: { cohortId: string; date: Date; start: string; end: string; mode: string }[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      for (const s of slots) {
        if (s.day === d.getUTCDay()) {
          data.push({
            cohortId,
            date: d,
            start: s.start,
            end: s.end,
            mode: c.mode === "ONLINE" ? "ONLINE" : "OFFLINE",
          });
        }
      }
    }
    if (data.length) await this.prisma.classSession.createMany({ data, skipDuplicates: true });
  }

  private view(
    s: {
      id: string;
      cohortId: string;
      date: Date;
      start: string;
      end: string;
      mode: string;
      topic: string | null;
      cancelled: boolean;
      takenAt: Date | null;
    } & {
      cohort: { name: string; course: { title: string } | null; _count: { members: number } };
      takenBy: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
      } | null;
      records: { status: string }[];
    },
  ): ClassSessionView {
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<
      AttendanceStatus,
      number
    >;
    for (const r of s.records)
      counts[r.status as AttendanceStatus] = (counts[r.status as AttendanceStatus] ?? 0) + 1;
    return {
      id: s.id,
      cohortId: s.cohortId,
      cohortName: s.cohort.name,
      courseTitle: s.cohort.course?.title ?? null,
      date: isoDay(s.date),
      start: s.start,
      end: s.end,
      mode: s.mode === "ONLINE" ? "ONLINE" : "OFFLINE",
      topic: s.topic,
      cancelled: s.cancelled,
      takenAt: s.takenAt?.toISOString() ?? null,
      takenBy: s.takenBy ? personName(s.takenBy) : null,
      counts,
      total: s.cohort._count.members,
    };
  }

  private cohortFilter(scope: StaffScope | null, cohortId?: string) {
    if (cohortId) return { cohortId };
    return scope ? { cohortId: { in: scope.cohortIds } } : {};
  }

  async listSessions(
    scope: StaffScope | null,
    q: { cohortId?: string; from: string; to: string },
  ): Promise<ClassSessionView[]> {
    const from = parseDay(q.from);
    const to = parseDay(q.to);
    if (to < from) throw new BadRequestException("The end date must be after the start date");
    const cohortIds = q.cohortId
      ? [q.cohortId]
      : scope
        ? scope.cohortIds
        : (
            await this.prisma.cohort.findMany({ where: { isActive: true }, select: { id: true } })
          ).map((c) => c.id);
    await Promise.all(cohortIds.map((id) => this.ensureSessions(id, from, to)));
    const rows = await this.prisma.classSession.findMany({
      where: { ...this.cohortFilter(scope, q.cohortId), date: { gte: from, lte: to } },
      include: SESSION_INCLUDE,
      orderBy: [{ date: "asc" }, { start: "asc" }],
    });
    return rows.map((r) => this.view(r));
  }

  private async sessionOrThrow(actor: RequestUser, id: string) {
    const s = await this.prisma.classSession.findUnique({
      where: { id },
      include: SESSION_INCLUDE,
    });
    if (!s) throw new NotFoundException("Class not found");
    await this.scope.assert(actor, "cohort", s.cohortId);
    return s;
  }

  async roster(actor: RequestUser, sessionId: string): Promise<SessionRoster> {
    const s = await this.sessionOrThrow(actor, sessionId);
    const cohort = await this.prisma.cohort.findUniqueOrThrow({
      where: { id: s.cohortId },
      select: {
        location: true,
        meetingUrl: true,
        members: { select: { user: { select: USER_NAME_SELECT } }, orderBy: { joinedAt: "asc" } },
      },
    });
    const records = await this.prisma.attendanceRecord.findMany({ where: { sessionId } });
    const byUser = new Map(records.map((r) => [r.userId, r]));
    const recent = await this.percentByStudent(
      s.cohortId,
      cohort.members.map((m) => m.user.id),
      addDays(todayIndia(), -30),
      todayIndia(),
    );
    const students = cohort.members
      .map(({ user }) => ({
        userId: user.id,
        name: personName(user),
        email: user.email,
        status: (byUser.get(user.id)?.status as AttendanceStatus | undefined) ?? null,
        note: byUser.get(user.id)?.note ?? null,
        recentPercent: recent.get(user.id) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      session: this.view(s),
      location: cohort.location,
      meetingUrl: cohort.meetingUrl,
      students,
    };
  }

  async mark(
    actor: RequestUser,
    sessionId: string,
    input: AttendanceMarkInput,
  ): Promise<SessionRoster> {
    const s = await this.sessionOrThrow(actor, sessionId);
    if (s.date > todayIndia())
      throw new BadRequestException("You can mark attendance once the class day comes");
    if (s.cancelled) throw new BadRequestException("This class was cancelled");
    const members = new Set(
      (
        await this.prisma.cohortMember.findMany({
          where: { cohortId: s.cohortId },
          select: { userId: true },
        })
      ).map((m) => m.userId),
    );
    for (const r of input.records) {
      if (!members.has(r.userId))
        throw new BadRequestException("Someone in the list isn't in this batch");
      if (!ATTENDANCE_STATUSES.includes(r.status))
        throw new BadRequestException("Unknown attendance status");
    }
    await this.prisma.$transaction([
      ...input.records.map((r) =>
        this.prisma.attendanceRecord.upsert({
          where: { sessionId_userId: { sessionId, userId: r.userId } },
          create: { sessionId, userId: r.userId, status: r.status, note: r.note?.trim() || null },
          update: { status: r.status, note: r.note?.trim() || null, markedAt: new Date() },
        }),
      ),
      this.prisma.classSession.update({
        where: { id: sessionId },
        data: {
          takenById: actor.id,
          takenAt: new Date(),
          ...(input.topic !== undefined ? { topic: input.topic?.trim() || null } : {}),
        },
      }),
    ]);
    return this.roster(actor, sessionId);
  }

  async addSession(
    actor: RequestUser,
    input: {
      cohortId: string;
      date: string;
      start: string;
      end: string;
      mode?: "OFFLINE" | "ONLINE";
      topic?: string;
    },
  ): Promise<ClassSessionView> {
    await this.scope.assert(actor, "cohort", input.cohortId);
    if (toMinutes(input.end) <= toMinutes(input.start))
      throw new BadRequestException("The class must end after it starts");
    const row = await this.prisma.classSession.upsert({
      where: {
        cohortId_date_start: {
          cohortId: input.cohortId,
          date: parseDay(input.date),
          start: input.start,
        },
      },
      create: {
        cohortId: input.cohortId,
        date: parseDay(input.date),
        start: input.start,
        end: input.end,
        mode: input.mode ?? "OFFLINE",
        topic: input.topic?.trim() || null,
      },
      update: { cancelled: false },
      include: SESSION_INCLUDE,
    });
    return this.view(row);
  }

  async updateSession(
    actor: RequestUser,
    id: string,
    input: { cancelled?: boolean; topic?: string | null },
  ): Promise<ClassSessionView> {
    await this.sessionOrThrow(actor, id);
    const row = await this.prisma.classSession.update({
      where: { id },
      data: {
        ...(input.cancelled !== undefined ? { cancelled: input.cancelled } : {}),
        ...(input.topic !== undefined ? { topic: input.topic?.trim() || null } : {}),
      },
      include: SESSION_INCLUDE,
    });
    return this.view(row);
  }

  // ------------------------------------------------------------ views

  /** attended / held (excused not counted) per student, for a batch and range. */
  async percentByStudent(
    cohortId: string,
    userIds: string[],
    from: Date,
    to: Date,
  ): Promise<Map<string, number | null>> {
    const rows = await this.prisma.attendanceRecord.findMany({
      where: {
        userId: { in: userIds },
        session: {
          cohortId,
          cancelled: false,
          date: { gte: from, lte: to },
          takenAt: { not: null },
        },
      },
      select: { userId: true, status: true },
    });
    const acc = new Map<string, { att: number; held: number }>();
    for (const r of rows) {
      const a = acc.get(r.userId) ?? { att: 0, held: 0 };
      if (r.status !== "EXCUSED") a.held++;
      if (attendedStatus(r.status as AttendanceStatus)) a.att++;
      acc.set(r.userId, a);
    }
    return new Map(
      userIds.map((id) => [id, acc.has(id) ? pct(acc.get(id)!.att, acc.get(id)!.held) : null]),
    );
  }

  async grid(cohortId: string, from: Date, to: Date): Promise<AttendanceGrid> {
    await this.ensureSessions(cohortId, from, to);
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: {
        name: true,
        course: { select: { title: true } },
        members: { select: { user: { select: USER_NAME_SELECT } } },
      },
    });
    if (!cohort) throw new NotFoundException("Batch not found");
    const sessions = await this.prisma.classSession.findMany({
      where: { cohortId, date: { gte: from, lte: to } },
      orderBy: [{ date: "asc" }, { start: "asc" }],
      include: { records: { select: { userId: true, status: true } } },
    });
    const students = cohort.members
      .map((m) => m.user)
      .sort((a, b) => personName(a).localeCompare(personName(b)));
    let batchAtt = 0;
    let batchHeld = 0;
    const rows = students.map((u) => {
      let present = 0;
      let late = 0;
      let absent = 0;
      let excused = 0;
      const statuses = sessions.map((s) => {
        const st = (s.records.find((r) => r.userId === u.id)?.status ??
          null) as AttendanceStatus | null;
        if (!s.cancelled && s.takenAt) {
          if (st === "PRESENT") present++;
          else if (st === "LATE") late++;
          else if (st === "ABSENT") absent++;
          else if (st === "EXCUSED") excused++;
        }
        return st;
      });
      const held = present + late + absent;
      batchAtt += present + late;
      batchHeld += held;
      return {
        userId: u.id,
        name: personName(u),
        email: u.email,
        statuses,
        present,
        late,
        absent,
        excused,
        percent: pct(present + late, held),
      };
    });
    return {
      cohortId,
      cohortName: cohort.name,
      courseTitle: cohort.course?.title ?? null,
      from: isoDay(from),
      to: isoDay(to),
      sessions: sessions.map((s) => ({
        id: s.id,
        date: isoDay(s.date),
        start: s.start,
        end: s.end,
        cancelled: s.cancelled,
        taken: !!s.takenAt,
      })),
      rows,
      percent: pct(batchAtt, batchHeld),
    };
  }

  /** One row per batch (optionally one course) for a month. */
  async overview(
    scope: StaffScope | null,
    q: { courseId?: string; month: string },
  ): Promise<AttendanceOverviewRow[]> {
    const { from, to } = monthRange(q.month);
    const today = todayIndia();
    const cohorts = await this.prisma.cohort.findMany({
      where: {
        isActive: true,
        ...(scope ? { id: { in: scope.cohortIds } } : {}),
        ...(q.courseId ? { courseId: q.courseId } : {}),
      },
      select: {
        id: true,
        name: true,
        course: { select: { title: true } },
        mentors: { where: { role: "PRIMARY" }, select: { mentor: { select: USER_NAME_SELECT } } },
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    });
    const out: AttendanceOverviewRow[] = [];
    for (const c of cohorts) {
      const grid = await this.grid(c.id, from, to < today ? to : today);
      const held = grid.sessions.filter((s) => s.taken && !s.cancelled).length;
      const pending = grid.sessions.filter((s) => !s.taken && !s.cancelled).length;
      out.push({
        cohortId: c.id,
        cohortName: c.name,
        courseTitle: c.course?.title ?? null,
        mentor: c.mentors[0] ? personName(c.mentors[0].mentor) : null,
        classesHeld: held,
        classesPending: pending,
        percent: grid.percent,
        students: c._count.members,
        lowAttendance: grid.rows.filter((r) => r.percent !== null && r.percent < 75).length,
      });
    }
    return out;
  }

  async myAttendance(userId: string): Promise<MyAttendanceView> {
    const memberships = await this.prisma.cohortMember.findMany({
      where: { userId, cohort: { isActive: true } },
      select: { cohort: { select: { id: true, name: true } } },
    });
    const today = todayIndia();
    const from = addDays(today, -90);
    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;
    const batches: MyAttendanceView["batches"] = [];
    for (const { cohort } of memberships) {
      await this.ensureSessions(cohort.id, addDays(today, -7), addDays(today, 7));
      const recs = await this.prisma.attendanceRecord.findMany({
        where: { userId, session: { cohortId: cohort.id, cancelled: false, date: { gte: from } } },
        select: { status: true },
      });
      let att = 0;
      let held = 0;
      for (const r of recs) {
        if (r.status === "PRESENT") present++;
        if (r.status === "LATE") late++;
        if (r.status === "ABSENT") absent++;
        if (r.status === "EXCUSED") excused++;
        if (r.status !== "EXCUSED") held++;
        if (attendedStatus(r.status as AttendanceStatus)) att++;
      }
      const next = await this.prisma.classSession.findFirst({
        where: { cohortId: cohort.id, cancelled: false, date: { gte: today } },
        orderBy: [{ date: "asc" }, { start: "asc" }],
        select: { date: true, start: true },
      });
      batches.push({
        id: cohort.id,
        name: cohort.name,
        percent: pct(att, held),
        nextClass: next
          ? `${DAY_NAMES[next.date.getUTCDay()]} ${isoDay(next.date)} ${next.start}`
          : null,
      });
    }
    const recentRows = await this.prisma.classSession.findMany({
      where: {
        cohortId: { in: memberships.map((m) => m.cohort.id) },
        cancelled: false,
        date: { lte: today },
        takenAt: { not: null },
      },
      orderBy: [{ date: "desc" }, { start: "desc" }],
      take: 10,
      select: {
        date: true,
        start: true,
        cohort: { select: { name: true } },
        records: { where: { userId }, select: { status: true } },
      },
    });
    return {
      percent: pct(present + late, present + late + absent),
      present,
      late,
      absent,
      excused,
      held: present + late + absent + excused,
      batches,
      recent: recentRows.map((r) => ({
        date: isoDay(r.date),
        start: r.start,
        cohortName: r.cohort.name,
        status: (r.records[0]?.status as AttendanceStatus | undefined) ?? null,
      })),
    };
  }

  // ------------------------------------------------------------ Excel

  periodRange(period: AttendancePeriod, date: string): { from: Date; to: Date; label: string } {
    const d = parseDay(date);
    if (period === "daily") return { from: d, to: d, label: date };
    if (period === "weekly") {
      const from = weekStart(d);
      return { from, to: addDays(from, 6), label: `week of ${isoDay(from)}` };
    }
    const { from, to } = monthRange(date.slice(0, 7));
    return { from, to, label: date.slice(0, 7) };
  }

  private gridColumns(sessions: AttendanceGrid["sessions"], withTotals: boolean): SheetColumn[] {
    return [
      { key: "email", header: "Email", width: 30, required: true },
      { key: "name", header: "Student", width: 24 },
      ...sessions.map((s) => ({
        key: s.id,
        header: `${s.date} ${s.start}`,
        width: 17,
        options: ["P", "A", "L", "E"],
      })),
      ...(withTotals
        ? [
            { key: "present", header: "Present", width: 9 },
            { key: "late", header: "Late", width: 7 },
            { key: "absent", header: "Absent", width: 8 },
            { key: "excused", header: "Excused", width: 9 },
            { key: "percent", header: "Attended %", width: 11 },
          ]
        : []),
    ];
  }

  private readonly instructions = [
    "One row per student, one column per class (date and start time, India time).",
    "In each class column write P (present), A (absent), L (late) or E (excused). Leave blank if not marked.",
    "Upload the same file back from the Attendance page: rows are matched on Email, classes on the column header.",
    "Attended % = (present + late) ÷ classes held. Excused classes are left out.",
  ];

  async exportFile(cohortId: string, period: AttendancePeriod, date: string, blank: boolean) {
    const { from, to, label } = this.periodRange(period, date);
    const grid = await this.grid(cohortId, from, to);
    const sessions = grid.sessions.filter((s) => !s.cancelled);
    const idx = new Map(grid.sessions.map((s, i) => [s.id, i]));
    const rows = grid.rows.map((r) => {
      const rec: Record<string, string | number | null> = { email: r.email, name: r.name };
      for (const s of sessions) {
        const st = r.statuses[idx.get(s.id)!];
        rec[s.id] = blank || !st ? "" : LETTER[st];
      }
      if (!blank) {
        rec.present = r.present;
        rec.late = r.late;
        rec.absent = r.absent;
        rec.excused = r.excused;
        rec.percent = r.percent ?? "";
      }
      return rec;
    });
    const buffer = await this.excel.build([
      {
        name: "Attendance",
        title: `${grid.cohortName}${grid.courseTitle ? ` · ${grid.courseTitle}` : ""} · attendance ${label}${blank ? " (template)" : ""}`,
        columns: this.gridColumns(sessions, !blank),
        rows,
        instructions: this.instructions,
      },
    ]);
    const kind = blank ? "template" : "attendance";
    return { buffer, fileName: `${grid.cohortName} ${kind} ${label}.xlsx` };
  }

  async importFile(
    actor: RequestUser,
    cohortId: string,
    contentBase64: string,
    dryRun: boolean,
  ): Promise<ImportPreview | ImportResult> {
    await this.scope.assert(actor, "cohort", cohortId);
    const { headers, rows } = await this.excel.readRaw(contentBase64, "Email");
    const emailCol = headers.findIndex((h) => h.toLowerCase() === "email");
    const classCols = headers
      .map((h, i) => ({ i, m: CLASS_HEADER.exec(h) }))
      .filter((x): x is { i: number; m: RegExpExecArray } => !!x.m);
    if (classCols.length === 0)
      throw new BadRequestException("No class columns found (headers like 2026-11-24 18:00)");
    const members = await this.prisma.cohortMember.findMany({
      where: { cohortId },
      select: { user: { select: { id: true, email: true } } },
    });
    const byEmail = new Map(members.map((m) => [m.user.email.toLowerCase(), m.user.id]));
    const today = todayIndia();
    const issues: { row: number; message: string }[] = [];
    const warnings: { row: number; message: string }[] = [];
    const marks: { date: string; start: string; userId: string; status: AttendanceStatus }[] = [];
    for (const c of classCols) {
      if (parseDay(c.m[1]!) > today)
        warnings.push({ row: 1, message: `${c.m[0]} is in the future and will be skipped` });
    }
    for (const r of rows) {
      const email = r.cells[emailCol]?.toLowerCase() ?? "";
      const userId = byEmail.get(email);
      if (!userId) {
        issues.push({
          row: r.row,
          message: email ? `${email} isn't in this batch` : "Email is missing",
        });
        continue;
      }
      for (const c of classCols) {
        const raw = (r.cells[c.i] ?? "").trim().toUpperCase();
        if (!raw) continue;
        const status = FROM_LETTER[raw];
        if (!status) {
          issues.push({
            row: r.row,
            message: `"${r.cells[c.i]}" under ${c.m[0]} isn't P, A, L or E`,
          });
          continue;
        }
        if (parseDay(c.m[1]!) > today) continue;
        marks.push({ date: c.m[1]!, start: c.m[2]!, userId, status });
      }
    }
    if (dryRun) {
      return {
        ok: marks.length,
        issues,
        warnings,
        columns: headers,
        sample: rows
          .slice(0, 8)
          .map((r) => Object.fromEntries(headers.map((h, i) => [h, r.cells[i] ?? ""]))),
      };
    }
    const sessionIds = new Map<string, string>();
    for (const key of new Set(marks.map((m) => `${m.date} ${m.start}`))) {
      const [date, start] = key.split(" ") as [string, string];
      const end = `${String(Math.floor((toMinutes(start) + 60) / 60) % 24).padStart(2, "0")}:${start.slice(3)}`;
      const s = await this.prisma.classSession.upsert({
        where: { cohortId_date_start: { cohortId, date: parseDay(date), start } },
        create: { cohortId, date: parseDay(date), start, end },
        update: {},
        select: { id: true },
      });
      sessionIds.set(key, s.id);
    }
    await this.prisma.$transaction(
      marks.map((m) => {
        const sessionId = sessionIds.get(`${m.date} ${m.start}`)!;
        return this.prisma.attendanceRecord.upsert({
          where: { sessionId_userId: { sessionId, userId: m.userId } },
          create: { sessionId, userId: m.userId, status: m.status },
          update: { status: m.status, markedAt: new Date() },
        });
      }),
    );
    await this.prisma.classSession.updateMany({
      where: { id: { in: [...sessionIds.values()] } },
      data: { takenById: actor.id, takenAt: new Date() },
    });
    const failedRows = rows.filter((r) => issues.some((i) => i.row === r.row));
    const cols = headers.map((h, i) => ({ key: String(i), header: h }));
    return {
      imported: marks.length,
      skipped: failedRows.length,
      issues,
      requests: 0,
      errorFile: await this.excel.errorFile(
        "Attendance",
        cols,
        failedRows.map((r) => ({
          values: Object.fromEntries(r.cells.map((v, i) => [String(i), v])),
          message: issues
            .filter((i) => i.row === r.row)
            .map((i) => i.message)
            .join("; "),
        })),
      ),
    };
  }
}
