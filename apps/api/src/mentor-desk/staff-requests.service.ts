import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  STAFF_REQUEST_LABEL,
  type ReviewableContentType,
  type StaffRequestKind,
  type StaffRequestView,
} from "@examora/types";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/types/request-user";
import { LessonsService } from "../content/lessons/lessons.service";
import { ModulesService } from "../content/modules/modules.service";
import { SubjectsService } from "../content/subjects/subjects.service";
import { TopicsService } from "../content/topics/topics.service";
import { QuizzesService } from "../assessment/quizzes/quizzes.service";
import { PrismaService } from "../prisma/prisma.service";
import { StaffScopeService, type ScopeKind } from "../staff/staff-scope.service";
import { UsersService } from "../users/users.service";
import { DeskNotifier } from "./desk-notifier.service";
import { USER_NAME_SELECT, person, personName } from "./desk-util";

const CONTENT_LABEL: Record<ReviewableContentType, string> = {
  subject: "Subject",
  topic: "Topic",
  module: "Module",
  lesson: "Lesson",
  quiz: "Past paper",
};

/** Fields shown when comparing a change (anything else is still applied). */
const SHOWN_FIELDS = [
  "title",
  "description",
  "content",
  "contentType",
  "videoUrl",
  "durationMinutes",
  "timeLimitMinutes",
  "exam",
  "paperYear",
  "note",
  "kind",
  "icon",
  "color",
];

type Row = {
  id: string;
  kind: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string;
  payload: unknown;
  note: string | null;
  status: string;
  decisionNote: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  requestedBy: { id: string; email: string; firstName: string | null; lastName: string | null };
  decidedBy: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

/**
 * Approvals other than deletions (mentor module): a mentor's edit to live
 * fixed content (CONTENT_CHANGE, applied on approval), a request to publish
 * a finished draft (CONTENT_PUBLISH), and a new student for a batch
 * (NEW_STUDENT: the admin creates the account and adds it).
 */
@Injectable()
export class StaffRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: DeskNotifier,
    private readonly scope: StaffScopeService,
    private readonly users: UsersService,
    private readonly subjects: SubjectsService,
    private readonly topics: TopicsService,
    private readonly modules: ModulesService,
    private readonly lessons: LessonsService,
    private readonly quizzes: QuizzesService,
  ) {}

  private static readonly INCLUDE = {
    requestedBy: { select: USER_NAME_SELECT },
    decidedBy: { select: USER_NAME_SELECT },
  } as const;

  /** The current record (for labels, diffs and checks). */
  async current(type: ReviewableContentType, id: string): Promise<Record<string, unknown> | null> {
    const p = this.prisma;
    const where = { id, deletedAt: null };
    switch (type) {
      case "subject":
        return p.subject.findFirst({ where });
      case "topic":
        return p.topic.findFirst({ where });
      case "module":
        return p.module.findFirst({ where });
      case "lesson":
        return p.lesson.findFirst({ where });
      case "quiz":
        return p.quiz.findFirst({ where });
    }
  }

  /** Past papers (a quiz with an exam year) are fixed content; mocks and quizzes are not. */
  isFixedQuiz(q: { paperYear?: unknown; exam?: unknown } | null): boolean {
    return !!q && q.paperYear !== null && q.paperYear !== undefined;
  }

  private async pendingFor(kind: StaffRequestKind, targetType: string, targetId: string) {
    return this.prisma.staffRequest.findFirst({
      where: { kind, targetType, targetId, status: "PENDING" },
      select: { id: true },
    });
  }

  /** Saves a mentor's edit to live content as a request (called by the review interceptor). */
  async requestChange(
    actor: RequestUser,
    type: ReviewableContentType,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<StaffRequestView> {
    const current = await this.current(type, id);
    if (!current) throw new NotFoundException("Not found");
    const label = String(current.title ?? "Untitled");
    const open = await this.prisma.staffRequest.findFirst({
      where: {
        kind: "CONTENT_CHANGE",
        targetType: type,
        targetId: id,
        status: "PENDING",
        requestedById: actor.id,
      },
    });
    const merged = { ...((open?.payload as Record<string, unknown>) ?? {}), ...patch };
    const row = open
      ? await this.prisma.staffRequest.update({
          where: { id: open.id },
          data: { payload: merged as object, createdAt: new Date() },
          include: StaffRequestsService.INCLUDE,
        })
      : await this.prisma.staffRequest.create({
          data: {
            kind: "CONTENT_CHANGE",
            targetType: type,
            targetId: id,
            targetLabel: label,
            payload: merged as object,
            requestedById: actor.id,
          },
          include: StaffRequestsService.INCLUDE,
        });
    await this.afterCreate(
      row,
      `${personName(row.requestedBy)} edited ${CONTENT_LABEL[type].toLowerCase()} "${label}"`,
    );
    return this.toView(row, current);
  }

  async requestPublish(
    actor: RequestUser,
    type: ReviewableContentType,
    id: string,
    note?: string,
  ): Promise<StaffRequestView> {
    const kind: ScopeKind = type === "quiz" ? "quiz" : type;
    await this.scope.assert(actor, kind, id);
    const current = await this.current(type, id);
    if (!current) throw new NotFoundException("Not found");
    if (current.status === "PUBLISHED") throw new BadRequestException("It's already published");
    if (await this.pendingFor("CONTENT_PUBLISH", type, id)) {
      throw new ConflictException("A publish request for this is already waiting");
    }
    const label = String(current.title ?? "Untitled");
    const row = await this.prisma.staffRequest.create({
      data: {
        kind: "CONTENT_PUBLISH",
        targetType: type,
        targetId: id,
        targetLabel: label,
        note: note?.trim() || null,
        requestedById: actor.id,
      },
      include: StaffRequestsService.INCLUDE,
    });
    await this.afterCreate(
      row,
      `${personName(row.requestedBy)} asks to publish ${CONTENT_LABEL[type].toLowerCase()} "${label}"`,
    );
    return this.toView(row, current);
  }

  async requestStudent(
    actor: RequestUser,
    input: {
      cohortId: string;
      name: string;
      email: string;
      phone?: string | null;
      note?: string | null;
    },
  ): Promise<StaffRequestView> {
    await this.scope.assert(actor, "cohort", input.cohortId);
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BadRequestException("Enter a valid email");
    const cohort = await this.prisma.cohort.findUniqueOrThrow({
      where: { id: input.cohortId },
      select: { name: true },
    });
    const existing = await this.prisma.staffRequest.findFirst({
      where: {
        kind: "NEW_STUDENT",
        status: "PENDING",
        targetId: input.cohortId,
        targetLabel: email,
      },
    });
    if (existing) throw new ConflictException(`${email} is already waiting for the admin`);
    const row = await this.prisma.staffRequest.create({
      data: {
        kind: "NEW_STUDENT",
        targetType: "batch",
        targetId: input.cohortId,
        targetLabel: email,
        payload: {
          name: input.name.trim(),
          email,
          phone: input.phone?.trim() || null,
          cohortName: cohort.name,
        },
        note: input.note?.trim() || null,
        requestedById: actor.id,
      },
      include: StaffRequestsService.INCLUDE,
    });
    await this.afterCreate(
      row,
      `${personName(row.requestedBy)} asks to add ${input.name.trim()} (${email}) to ${cohort.name}`,
    );
    return this.toView(row, null);
  }

  private async afterCreate(row: Row, body: string) {
    await this.audit.record({
      actorId: row.requestedBy.id,
      action: `staff_request.created`,
      entityType: "StaffRequest",
      entityId: row.id,
      after: { kind: row.kind, targetType: row.targetType, targetId: row.targetId },
    });
    await this.notify.admins(
      "staff.request_created",
      `${STAFF_REQUEST_LABEL[row.kind as StaffRequestKind]}: ${row.targetLabel}`,
      body,
      { requestId: row.id, url: "/approvals" },
    );
  }

  // ------------------------------------------------------------ lists

  async list(status?: string, kind?: string): Promise<StaffRequestView[]> {
    const rows = await this.prisma.staffRequest.findMany({
      where: { ...(status ? { status } : {}), ...(kind ? { kind } : {}) },
      include: StaffRequestsService.INCLUDE,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    return Promise.all(rows.map((r) => this.withCurrent(r)));
  }

  async listMine(userId: string): Promise<StaffRequestView[]> {
    const rows = await this.prisma.staffRequest.findMany({
      where: { requestedById: userId },
      include: StaffRequestsService.INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return Promise.all(rows.map((r) => this.withCurrent(r)));
  }

  /** Pending publish/change requests per content id (for "waiting for review" chips). */
  async pendingContent(ids: string[]): Promise<Record<string, StaffRequestKind[]>> {
    const rows = await this.prisma.staffRequest.findMany({
      where: {
        status: "PENDING",
        targetId: { in: ids },
        kind: { in: ["CONTENT_CHANGE", "CONTENT_PUBLISH"] },
      },
      select: { targetId: true, kind: true },
    });
    const out: Record<string, StaffRequestKind[]> = {};
    for (const r of rows) (out[r.targetId!] ??= []).push(r.kind as StaffRequestKind);
    return out;
  }

  private async withCurrent(r: Row): Promise<StaffRequestView> {
    const current =
      r.kind === "NEW_STUDENT" || !r.targetId
        ? null
        : await this.current(r.targetType as ReviewableContentType, r.targetId).catch(() => null);
    return this.toView(r, current);
  }

  // ------------------------------------------------------------ decisions

  async approve(actor: RequestUser, id: string, note?: string): Promise<StaffRequestView> {
    const row = await this.prisma.staffRequest.findUnique({
      where: { id },
      include: StaffRequestsService.INCLUDE,
    });
    if (!row) throw new NotFoundException("Request not found");
    if (row.status !== "PENDING") throw new BadRequestException("This request was already decided");
    const type = row.targetType as ReviewableContentType;
    if (row.kind === "CONTENT_CHANGE") {
      await this.applyChange(type, row.targetId!, row.payload as Record<string, unknown>);
    } else if (row.kind === "CONTENT_PUBLISH") {
      await this.applyPublish(type, row.targetId!);
    } else if (row.kind === "NEW_STUDENT") {
      await this.applyStudent(row.targetId!, row.payload as { name: string; email: string });
    }
    const updated = await this.prisma.staffRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        decidedById: actor.id,
        decidedAt: new Date(),
        decisionNote: note?.trim() || null,
      },
      include: StaffRequestsService.INCLUDE,
    });
    await this.audit.record({
      actorId: actor.id,
      action: "staff_request.approved",
      entityType: "StaffRequest",
      entityId: id,
      after: { kind: row.kind, targetType: row.targetType, targetId: row.targetId },
    });
    await this.notify.user(
      row.requestedById,
      "staff.request_approved",
      `Approved: ${row.targetLabel}`,
      `${STAFF_REQUEST_LABEL[row.kind as StaffRequestKind]} approved by an administrator.${note ? ` ${note}` : ""}`,
      { requestId: id, url: "/approvals" },
    );
    return this.withCurrent(updated);
  }

  async reject(actor: RequestUser, id: string, note: string): Promise<StaffRequestView> {
    if (!note?.trim()) throw new BadRequestException("Say why, so the mentor knows what to change");
    const row = await this.prisma.staffRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Request not found");
    if (row.status !== "PENDING") throw new BadRequestException("This request was already decided");
    const updated = await this.prisma.staffRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        decidedById: actor.id,
        decidedAt: new Date(),
        decisionNote: note.trim(),
      },
      include: StaffRequestsService.INCLUDE,
    });
    await this.audit.record({
      actorId: actor.id,
      action: "staff_request.rejected",
      entityType: "StaffRequest",
      entityId: id,
      after: { kind: row.kind, note: note.trim() },
    });
    await this.notify.user(
      row.requestedById,
      "staff.request_rejected",
      `Sent back: ${row.targetLabel}`,
      `An administrator sent it back: ${note.trim()}`,
      { requestId: id, url: "/approvals" },
    );
    return this.withCurrent(updated);
  }

  private async applyChange(
    type: ReviewableContentType,
    id: string,
    patch: Record<string, unknown>,
  ) {
    // Each service validates and applies exactly as an admin edit would.
    switch (type) {
      case "subject":
        return this.subjects.update(id, patch as never);
      case "topic":
        return this.topics.update(id, patch as never);
      case "module":
        return this.modules.update(id, patch as never);
      case "lesson":
        return this.lessons.update(id, patch as never);
      case "quiz":
        return this.quizzes.update(id, patch as never);
    }
  }

  private async applyPublish(type: ReviewableContentType, id: string) {
    switch (type) {
      case "subject":
        return this.subjects.changeStatus(id, "PUBLISHED");
      case "topic":
        return this.topics.changeStatus(id, "PUBLISHED");
      case "module":
        return this.modules.changeStatus(id, "PUBLISHED");
      case "lesson":
        return this.lessons.changeStatus(id, "PUBLISHED");
      case "quiz":
        return this.quizzes.changeStatus(id, "PUBLISHED");
    }
  }

  private async applyStudent(cohortId: string, p: { name: string; email: string }) {
    let user = await this.prisma.user.findFirst({
      where: { email: { equals: p.email, mode: "insensitive" }, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      const [firstName, ...rest] = p.name.split(/\s+/);
      user = await this.users.createWithDefaultRole({
        email: p.email,
        firstName,
        lastName: rest.join(" ") || undefined,
        defaultRole: "STUDENT",
      });
    }
    await this.prisma.cohortMember.createMany({
      data: [{ cohortId, userId: user.id }],
      skipDuplicates: true,
    });
    this.scope.invalidate();
  }

  // ------------------------------------------------------------ batch members Excel

  static readonly MEMBER_COLUMNS = [
    { key: "name", header: "Name", width: 26, required: true },
    { key: "email", header: "Email", width: 32, required: true },
    { key: "phone", header: "Phone", width: 16 },
    { key: "guardianPhone", header: "Parent phone", width: 16 },
  ];

  async membersRows(cohortId: string) {
    const rows = await this.prisma.cohortMember.findMany({
      where: { cohortId },
      orderBy: { joinedAt: "asc" },
      select: { user: { select: { ...USER_NAME_SELECT, phone: true, guardianPhone: true } } },
    });
    return rows.map(({ user }) => ({
      name: personName(user),
      email: user.email,
      phone: user.phone ?? "",
      guardianPhone: user.guardianPhone ?? "",
    }));
  }

  /**
   * Batch members from the template. An administrator's upload adds existing
   * students and creates accounts for new ones; a mentor can't add students,
   * so each row becomes a request for the admin.
   */
  async importMembers(
    actor: RequestUser,
    cohortId: string,
    rows: (Record<string, string> & { __row: string })[],
    dryRun: boolean,
    canManage: boolean,
  ) {
    await this.scope.assert(actor, "cohort", cohortId);
    const issues: { row: number; message: string }[] = [];
    const warnings: { row: number; message: string }[] = [];
    const valid: {
      row: number;
      name: string;
      email: string;
      phone: string | null;
      guardianPhone: string | null;
    }[] = [];
    const members = new Set(
      (
        await this.prisma.cohortMember.findMany({
          where: { cohortId },
          select: { user: { select: { email: true } } },
        })
      ).map((m) => m.user.email.toLowerCase()),
    );
    for (const r of rows) {
      const row = Number(r.__row);
      const email = (r.email ?? "").trim().toLowerCase();
      const name = (r.name ?? "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        issues.push({
          row,
          message: email ? `"${email}" isn't a valid email` : "Email is missing",
        });
        continue;
      }
      if (name.length < 2) {
        issues.push({ row, message: "Name is missing" });
        continue;
      }
      if (members.has(email)) {
        warnings.push({ row, message: `${email} is already in this batch` });
        continue;
      }
      if (valid.some((v) => v.email === email)) {
        warnings.push({ row, message: `${email} appears twice` });
        continue;
      }
      valid.push({
        row,
        name,
        email,
        phone: r.phone?.trim() || null,
        guardianPhone: r.guardianPhone?.trim() || null,
      });
    }
    const existing = new Map(
      (
        await this.prisma.user.findMany({
          where: { email: { in: valid.map((v) => v.email), mode: "insensitive" }, deletedAt: null },
          select: { id: true, email: true },
        })
      ).map((u) => [u.email.toLowerCase(), u.id]),
    );
    for (const v of valid) {
      if (!existing.has(v.email)) {
        warnings.push({
          row: v.row,
          message: canManage
            ? `${v.email} is new: an account will be created`
            : `${v.email} is new: the admin will create the account`,
        });
      }
    }
    if (dryRun) return { valid: valid.length, issues, warnings };
    let added = 0;
    let requests = 0;
    for (const v of valid) {
      if (canManage) {
        let userId = existing.get(v.email);
        if (!userId) {
          const [firstName, ...rest] = v.name.split(/\s+/);
          const u = await this.users.createWithDefaultRole({
            email: v.email,
            firstName,
            lastName: rest.join(" ") || undefined,
            defaultRole: "STUDENT",
          });
          userId = u.id;
          if (v.phone || v.guardianPhone) {
            await this.prisma.user.update({
              where: { id: userId },
              data: { phone: v.phone, guardianPhone: v.guardianPhone },
            });
          }
        }
        await this.prisma.cohortMember.createMany({
          data: [{ cohortId, userId }],
          skipDuplicates: true,
        });
        added++;
      } else {
        try {
          await this.requestStudent(actor, {
            cohortId,
            name: v.name,
            email: v.email,
            phone: v.phone,
          });
          requests++;
        } catch (err) {
          issues.push({
            row: v.row,
            message: err instanceof Error ? err.message : "Couldn't send the request",
          });
        }
      }
    }
    this.scope.invalidate();
    return { valid: valid.length, issues, warnings, added, requests };
  }

  // ------------------------------------------------------------ view

  private toView(r: Row, current: Record<string, unknown> | null): StaffRequestView {
    const payload = (r.payload ?? {}) as Record<string, unknown>;
    const changes =
      r.kind === "CONTENT_CHANGE"
        ? Object.keys(payload)
            .filter((k) => SHOWN_FIELDS.includes(k))
            .map((field) => ({
              field,
              before: current ? String(current[field] ?? "") : "",
              after: String(payload[field] ?? ""),
            }))
        : [];
    const student =
      r.kind === "NEW_STUDENT"
        ? {
            name: String(payload.name ?? ""),
            email: String(payload.email ?? r.targetLabel),
            phone: (payload.phone as string | null) ?? null,
            cohortName: (payload.cohortName as string | null) ?? null,
            exists: false,
          }
        : null;
    return {
      id: r.id,
      kind: r.kind as StaffRequestKind,
      targetType: r.targetType,
      targetId: r.targetId,
      targetLabel: r.targetLabel,
      note: r.note,
      status: r.status as StaffRequestView["status"],
      requestedBy: person(r.requestedBy),
      decidedBy: r.decidedBy ? { id: r.decidedBy.id, name: personName(r.decidedBy) } : null,
      decisionNote: r.decisionNote,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
      changes,
      student,
    };
  }
}
