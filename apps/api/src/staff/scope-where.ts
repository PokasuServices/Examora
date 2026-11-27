import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Prisma } from "@examora/database";
import type { StaffScope } from "./staff-scope.service";

/**
 * Prisma filters that keep a list inside a mentor's scope. Each takes the
 * scope (null = unrestricted) and returns a filter to AND into the list's
 * where clause, or undefined when nothing needs filtering.
 */
export const scopeWhere = {
  course: (s: StaffScope | null): Prisma.CourseWhereInput | undefined =>
    s ? { id: { in: s.courseIds } } : undefined,
  subject: (s: StaffScope | null): Prisma.SubjectWhereInput | undefined =>
    s ? { courseId: { in: s.courseIds } } : undefined,
  topic: (s: StaffScope | null): Prisma.TopicWhereInput | undefined =>
    s ? { subject: { courseId: { in: s.courseIds } } } : undefined,
  module: (s: StaffScope | null): Prisma.ModuleWhereInput | undefined =>
    s ? { topic: { subject: { courseId: { in: s.courseIds } } } } : undefined,
  lesson: (s: StaffScope | null): Prisma.LessonWhereInput | undefined =>
    s ? { module: { topic: { subject: { courseId: { in: s.courseIds } } } } } : undefined,
  /** Quizzes of my courses, ones I wrote, and ones published to my batches. */
  quiz: (s: StaffScope | null): Prisma.QuizWhereInput | undefined => {
    if (!s) return undefined;
    const inCourses = { in: s.courseIds };
    return {
      OR: [
        { subject: { courseId: inCourses } },
        { topic: { subject: { courseId: inCourses } } },
        { practiceCategory: { courseId: inCourses } },
        { cohorts: { some: { cohortId: { in: s.cohortIds } } } },
        { createdById: s.userId },
      ],
    };
  },
  question: (s: StaffScope | null): Prisma.QuestionWhereInput | undefined => {
    if (!s) return undefined;
    const inCourses = { in: s.courseIds };
    return {
      OR: [
        { subject: { courseId: inCourses } },
        { topic: { subject: { courseId: inCourses } } },
        { createdById: s.userId },
      ],
    };
  },
  assignment: (s: StaffScope | null): Prisma.AssignmentWhereInput | undefined =>
    s
      ? { OR: [{ subject: { courseId: { in: s.courseIds } } }, { createdById: s.userId }] }
      : undefined,
  submission: (s: StaffScope | null): Prisma.AssignmentSubmissionWhereInput | undefined =>
    s ? { studentId: { in: s.studentIds } } : undefined,
  attempt: (s: StaffScope | null): Prisma.QuizAttemptWhereInput | undefined =>
    s ? { userId: { in: s.studentIds } } : undefined,
  cohort: (s: StaffScope | null): Prisma.CohortWhereInput | undefined =>
    s ? { id: { in: s.cohortIds } } : undefined,
};

/** Request key the StaffScopeGuard stores the caller's scope under. */
export const STAFF_SCOPE_REQUEST_KEY = "staffScope";

/**
 * The caller's StaffScope (null for administrators), as computed by the
 * global StaffScopeGuard. Use in list handlers: `@ActorScope() scope`.
 */
export const ActorScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StaffScope | null => {
    const request = ctx.switchToHttp().getRequest<Record<string, unknown>>();
    return (request[STAFF_SCOPE_REQUEST_KEY] as StaffScope | null | undefined) ?? null;
  },
);

/**
 * Student side: a quiz published to particular batches (QuizCohort rows) is
 * only for students in those batches; a quiz with no batches is for everyone
 * on the course, as before.
 */
export function quizAudience(userId: string): Prisma.QuizWhereInput {
  return {
    OR: [
      { cohorts: { none: {} } },
      { cohorts: { some: { cohort: { members: { some: { userId } } } } } },
    ],
  };
}
