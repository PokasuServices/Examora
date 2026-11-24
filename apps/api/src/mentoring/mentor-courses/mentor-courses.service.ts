import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  MentorCourseAssignmentRow,
  MentorCourseOption,
  MentorCourseProgress,
  MentorCourseStudentRow,
} from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";

const FINISHED = ["SUBMITTED", "AUTO_SUBMITTED"] as const;

type AssignmentState = keyof MentorCourseStudentRow["assignments"];

/** Maps a latest submission status to the bucket mentors track. */
export function assignmentState(status: string | undefined): AssignmentState {
  switch (status) {
    case undefined:
      return "notStarted";
    case "DRAFT":
      return "draft";
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "awaitingReview";
    case "REVISION_REQUESTED":
      return "revisionRequested";
    case "APPROVED":
      return "approved";
    default:
      return "draft";
  }
}

const emptyBuckets = () => ({
  notStarted: 0,
  draft: 0,
  awaitingReview: 0,
  revisionRequested: 0,
  approved: 0,
});

function displayName(u: { firstName: string | null; lastName: string | null; email: string }) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return name || u.email;
}

function latest(a: Date | null | undefined, b: Date | null | undefined): Date | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * A mentor's view of their current students' progress in one course
 * (lessons, tests, assignments). Only students actively assigned to the
 * mentor and actively licensed for the course are included.
 */
@Injectable()
export class MentorCoursesService {
  constructor(private readonly prisma: PrismaService) {}

  private async caseload(mentorId: string): Promise<string[]> {
    const rows = await this.prisma.mentorAssignment.findMany({
      where: { mentorId, unassignedAt: null },
      select: { studentId: true },
    });
    return [...new Set(rows.map((r) => r.studentId))];
  }

  private licensedWhere(studentIds: string[]) {
    const now = new Date();
    return {
      userId: { in: studentIds },
      status: "ACTIVE" as const,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      course: { deletedAt: null },
    };
  }

  async courses(mentorId: string): Promise<MentorCourseOption[]> {
    const studentIds = await this.caseload(mentorId);
    if (studentIds.length === 0) return [];
    const enrollments = await this.prisma.enrollment.findMany({
      where: this.licensedWhere(studentIds),
      select: { courseId: true, userId: true, course: { select: { title: true } } },
    });
    const byCourse = new Map<string, { title: string; students: Set<string> }>();
    for (const e of enrollments) {
      const entry = byCourse.get(e.courseId) ?? { title: e.course.title, students: new Set() };
      entry.students.add(e.userId);
      byCourse.set(e.courseId, entry);
    }
    return [...byCourse.entries()]
      .map(([id, v]) => ({ id, title: v.title, studentCount: v.students.size }))
      .sort((a, b) => b.studentCount - a.studentCount || a.title.localeCompare(b.title));
  }

  async progress(mentorId: string, courseId: string): Promise<MentorCourseProgress> {
    const caseload = await this.caseload(mentorId);
    const enrollments = caseload.length
      ? await this.prisma.enrollment.findMany({
          where: { ...this.licensedWhere(caseload), courseId },
          select: { userId: true },
        })
      : [];
    const studentIds = [...new Set(enrollments.map((e) => e.userId))];
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, deletedAt: null },
      select: { id: true, title: true },
    });
    // A course none of the mentor's students hold is not theirs to look at.
    if (!course || studentIds.length === 0) throw new NotFoundException("Course not found");

    const live = { deletedAt: null, status: "PUBLISHED" as const };
    const inCourse = { subject: { courseId, deletedAt: null } };
    const [lessons, quizzes, assignments, users] = await Promise.all([
      this.prisma.lesson.findMany({
        where: { ...live, module: { deletedAt: null, topic: { deletedAt: null, ...inCourse } } },
        select: { id: true },
      }),
      this.prisma.quiz.findMany({ where: { ...live, ...inCourse }, select: { id: true } }),
      this.prisma.assignment.findMany({
        where: { ...live, ...inCourse },
        select: { id: true, title: true, deadline: true },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.user.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, email: true, firstName: true, lastName: true },
      }),
    ]);
    const lessonIds = lessons.map((l) => l.id);
    const quizIds = quizzes.map((q) => q.id);
    const assignmentIds = assignments.map((a) => a.id);

    const [progressRows, attempts, submissions] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { courseId, userId: { in: studentIds } },
        select: { userId: true, lessonId: true, completedAt: true, updatedAt: true },
      }),
      quizIds.length
        ? this.prisma.quizAttempt.findMany({
            where: { quizId: { in: quizIds }, userId: { in: studentIds } },
            select: {
              userId: true,
              quizId: true,
              status: true,
              obtainedMarks: true,
              totalMarks: true,
              startedAt: true,
              submittedAt: true,
            },
          })
        : Promise.resolve([]),
      assignmentIds.length
        ? this.prisma.assignmentSubmission.findMany({
            where: { assignmentId: { in: assignmentIds }, studentId: { in: studentIds } },
            select: {
              assignmentId: true,
              studentId: true,
              version: true,
              status: true,
              updatedAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    // Latest submission version per (assignment, student).
    const latestSub = new Map<string, (typeof submissions)[number]>();
    for (const s of submissions) {
      const key = `${s.assignmentId}:${s.studentId}`;
      const seen = latestSub.get(key);
      if (!seen || s.version > seen.version) latestSub.set(key, s);
    }

    const lessonSet = new Set(lessonIds);
    const students: MentorCourseStudentRow[] = users.map((u) => {
      let lastActive: Date | null = null;
      let lessonsCompleted = 0;
      for (const p of progressRows) {
        if (p.userId !== u.id) continue;
        if (p.completedAt && lessonSet.has(p.lessonId)) lessonsCompleted++;
        lastActive = latest(lastActive, p.updatedAt);
      }
      const taken = new Set<string>();
      const percents: number[] = [];
      for (const a of attempts) {
        if (a.userId !== u.id) continue;
        lastActive = latest(lastActive, a.submittedAt ?? a.startedAt);
        if (!FINISHED.includes(a.status as (typeof FINISHED)[number])) continue;
        taken.add(a.quizId);
        const total = Number(a.totalMarks);
        if (total > 0 && a.obtainedMarks !== null) {
          percents.push((Number(a.obtainedMarks) / total) * 100);
        }
      }
      const buckets = emptyBuckets();
      for (const as of assignments) {
        const sub = latestSub.get(`${as.id}:${u.id}`);
        buckets[assignmentState(sub?.status)]++;
        if (sub) lastActive = latest(lastActive, sub.updatedAt);
      }
      return {
        studentId: u.id,
        name: displayName(u),
        email: u.email,
        lessonsCompleted,
        completionPercent: lessonIds.length
          ? Math.round((lessonsCompleted / lessonIds.length) * 100)
          : 0,
        testsTaken: taken.size,
        testAveragePercent: percents.length
          ? Math.round(percents.reduce((s, p) => s + p, 0) / percents.length)
          : null,
        assignments: buckets,
        lastActiveAt: lastActive ? lastActive.toISOString() : null,
      };
    });
    students.sort((a, b) => a.name.localeCompare(b.name));

    const assignmentRows: MentorCourseAssignmentRow[] = assignments.map((as) => {
      const buckets = emptyBuckets();
      for (const u of users) buckets[assignmentState(latestSub.get(`${as.id}:${u.id}`)?.status)]++;
      return {
        id: as.id,
        title: as.title,
        deadline: as.deadline ? as.deadline.toISOString() : null,
        ...buckets,
      };
    });

    return {
      course: {
        id: course.id,
        title: course.title,
        lessonCount: lessonIds.length,
        testCount: quizIds.length,
        assignmentCount: assignmentIds.length,
      },
      students,
      assignments: assignmentRows,
    };
  }
}
