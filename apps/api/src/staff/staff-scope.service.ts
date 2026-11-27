import { Injectable, NotFoundException } from "@nestjs/common";
import { scopeWhere } from "./scope-where";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/request-user";

/** What a mentor works on: the batches the admin gave them, and through those, courses and students. */
export interface StaffScope {
  userId: string;
  cohortIds: string[];
  courseIds: string[];
  studentIds: string[];
}

/** Records a route can be scoped by (see @Scoped). */
export type ScopeKind =
  | "course"
  | "subject"
  | "topic"
  | "module"
  | "lesson"
  | "quiz"
  | "question"
  | "assignment"
  | "cohort"
  | "student"
  | "submission"
  | "attempt"
  | "answer"
  | "sketchVersion"
  | "practiceCategory";

const CACHE_MS = 5_000;

/** Today in India as a UTC-midnight date (cover end dates are India dates). */
function todayIndia(): Date {
  const ist = new Date(Date.now() + 330 * 60_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

/**
 * Mentor scoping (mentor module, Phase 1). Administrators see everything; a
 * mentor (MENTOR without ADMINISTRATOR) sees only the batches they are the
 * PRIMARY mentor of, or COVER for until the cover's end date, and through
 * those the batches' courses and students. Anything else is hidden: routes
 * answer 404 as if it didn't exist, and lists leave it out.
 */
@Injectable()
export class StaffScopeService {
  private readonly cache = new Map<string, { at: number; scope: StaffScope }>();

  constructor(private readonly prisma: PrismaService) {}

  /** True when this user is limited to their own batches. */
  isScoped(actor: Pick<RequestUser, "roles">): boolean {
    return actor.roles.includes("MENTOR") && !actor.roles.includes("ADMINISTRATOR");
  }

  /** null = unrestricted (administrators and non-mentor staff). */
  async scopeFor(actor: Pick<RequestUser, "id" | "roles">): Promise<StaffScope | null> {
    if (!this.isScoped(actor)) return null;
    return this.mentorScope(actor.id);
  }

  async mentorScope(mentorId: string): Promise<StaffScope> {
    const hit = this.cache.get(mentorId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.scope;
    const rows = await this.prisma.cohortMentor.findMany({
      where: {
        mentorId,
        OR: [
          { role: "PRIMARY" },
          { role: "COVER", OR: [{ endsOn: null }, { endsOn: { gte: todayIndia() } }] },
        ],
      },
      select: { cohort: { select: { id: true, courseId: true } } },
    });
    const cohortIds = rows.map((r) => r.cohort.id);
    const courseIds = [
      ...new Set(rows.map((r) => r.cohort.courseId).filter((c): c is string => !!c)),
    ];
    const members = cohortIds.length
      ? await this.prisma.cohortMember.findMany({
          where: { cohortId: { in: cohortIds } },
          select: { userId: true },
        })
      : [];
    const scope: StaffScope = {
      userId: mentorId,
      cohortIds,
      courseIds,
      studentIds: [...new Set(members.map((m) => m.userId))],
    };
    this.cache.set(mentorId, { at: Date.now(), scope });
    return scope;
  }

  /** Forget cached scopes (after batch mentors or members change). */
  invalidate(): void {
    this.cache.clear();
  }

  /** The PRIMARY/active mentors of a student's batches (who marks their work). */
  async mentorsOfStudent(studentId: string): Promise<string[]> {
    const rows = await this.prisma.cohortMentor.findMany({
      where: {
        cohort: { members: { some: { userId: studentId } }, isActive: true },
        OR: [
          { role: "PRIMARY" },
          { role: "COVER", OR: [{ endsOn: null }, { endsOn: { gte: todayIndia() } }] },
        ],
      },
      select: { mentorId: true },
    });
    return [...new Set(rows.map((r) => r.mentorId))];
  }

  // ---------------------------------------------------------------------
  // Single-record checks

  /** Throws 404 unless the actor may see this record. */
  async assert(
    actor: Pick<RequestUser, "id" | "roles">,
    kind: ScopeKind,
    id: string,
  ): Promise<void> {
    const scope = await this.scopeFor(actor);
    if (!scope) return;
    if (!(await this.allows(scope, kind, id))) {
      throw new NotFoundException("Not found");
    }
  }

  async allows(scope: StaffScope, kind: ScopeKind, id: string): Promise<boolean> {
    const inCourse = (courseId: string | null | undefined) =>
      !!courseId && scope.courseIds.includes(courseId);
    const p = this.prisma;
    switch (kind) {
      case "course":
        return scope.courseIds.includes(id);
      case "cohort":
        return scope.cohortIds.includes(id);
      case "student":
        return scope.studentIds.includes(id);
      case "subject": {
        const r = await p.subject.findUnique({ where: { id }, select: { courseId: true } });
        return inCourse(r?.courseId);
      }
      case "topic": {
        const r = await p.topic.findUnique({
          where: { id },
          select: { subject: { select: { courseId: true } } },
        });
        return inCourse(r?.subject.courseId);
      }
      case "module": {
        const r = await p.module.findUnique({
          where: { id },
          select: { topic: { select: { subject: { select: { courseId: true } } } } },
        });
        return inCourse(r?.topic.subject.courseId);
      }
      case "lesson": {
        const r = await p.lesson.findUnique({
          where: { id },
          select: {
            module: { select: { topic: { select: { subject: { select: { courseId: true } } } } } },
          },
        });
        return inCourse(r?.module.topic.subject.courseId);
      }
      case "practiceCategory": {
        const r = await p.practiceCategory.findUnique({
          where: { id },
          select: { courseId: true },
        });
        return inCourse(r?.courseId);
      }
      case "quiz":
        return (await p.quiz.count({ where: { id, ...scopeWhere.quiz(scope) } })) > 0;
      case "question":
        return (await p.question.count({ where: { id, ...scopeWhere.question(scope) } })) > 0;
      case "assignment":
        return (await p.assignment.count({ where: { id, ...scopeWhere.assignment(scope) } })) > 0;
      case "submission": {
        const r = await p.assignmentSubmission.findUnique({
          where: { id },
          select: { studentId: true },
        });
        return !!r && scope.studentIds.includes(r.studentId);
      }
      case "attempt": {
        const r = await p.quizAttempt.findUnique({ where: { id }, select: { userId: true } });
        return !!r && scope.studentIds.includes(r.userId);
      }
      case "answer": {
        const r = await p.quizAttemptAnswer.findUnique({
          where: { id },
          select: { attempt: { select: { userId: true } } },
        });
        return !!r && scope.studentIds.includes(r.attempt.userId);
      }
      case "sketchVersion": {
        const r = await p.sketchVersion.findUnique({
          where: { id },
          select: { work: { select: { userId: true } } },
        });
        return !!r && scope.studentIds.includes(r.work.userId);
      }
    }
  }
}
