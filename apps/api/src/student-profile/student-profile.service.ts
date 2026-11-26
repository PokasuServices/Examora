import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AnswerMethod,
  CheckpointView,
  CohortView,
  GoalView,
  ProfileActivityItem,
  ProfileOverview,
  ProfilePerformancePoint,
  RevisionItem,
} from "@examora/types";
import { XpService } from "../gamification/xp.service";
import { PrismaService } from "../prisma/prisma.service";

const FINISHED = ["SUBMITTED", "AUTO_SUBMITTED"] as const;
const ACTIVITY_LIMIT = 60;
/** Goals compare against the average of this many most recent test results in the course. */
const GOAL_RECENT_TESTS = 5;

export const XP_REASON_LABEL: Record<string, string> = {
  LESSON_COMPLETED: "Lesson completed",
  QUIZ_COMPLETED: "Quiz finished",
  QUIZ_PERFECT_BONUS: "Perfect score bonus",
  TEST_COMPLETED: "Test finished",
  DAILY_QUIZ: "Daily quiz",
  DAILY_QUIZ_CATCH_UP: "Daily quiz (caught up)",
  TEST_SHARED: "A friend opened your shared test",
  TEST_PERFECT_BONUS: "Perfect score bonus",
  SKETCH_SELF_RATING: "Rated your own sketch",
  SKETCH_PEER_FEEDBACK: "Gave feedback on a classmate's sketch",
  WELCOME: "Welcome bonus",
};

/** Student profile: overview, activity, performance, revision, goals, checkpoints (phase 8). */
@Injectable()
export class StudentProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
  ) {}

  private async licensedCourses(userId: string) {
    const rows = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        course: { status: "PUBLISHED", deletedAt: null },
      },
      select: { course: { select: { id: true, title: true, position: true } } },
    });
    return rows
      .map((r) => r.course)
      .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
      .map(({ id, title }) => ({ id, title }));
  }

  async overview(userId: string): Promise<ProfileOverview> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        examYear: true,
        cohortMemberships: {
          select: { cohort: { select: { id: true, name: true, batch: true } } },
        },
        mentorFeedbackAsStudent: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            body: true,
            createdAt: true,
            mentor: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });
    return {
      name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email,
      email: user.email,
      city: null,
      examYear: user.examYear,
      courses: await this.licensedCourses(userId),
      totalXp: await this.xp.getTotal(userId),
      cohorts: user.cohortMemberships.map((m) => m.cohort),
      mentorComments: user.mentorFeedbackAsStudent.map((f) => ({
        id: f.id,
        body: f.body,
        mentorName:
          `${f.mentor.firstName ?? ""} ${f.mentor.lastName ?? ""}`.trim() || f.mentor.email,
        createdAt: f.createdAt.toISOString(),
      })),
    };
  }

  async activity(userId: string): Promise<ProfileActivityItem[]> {
    const [lessons, attempts, xp, daily, sketches] = await Promise.all([
      this.prisma.lessonProgress.findMany({
        where: { userId, completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: ACTIVITY_LIMIT,
        select: { completedAt: true, lesson: { select: { title: true } } },
      }),
      this.prisma.quizAttempt.findMany({
        where: { userId, status: { in: [...FINISHED] } },
        orderBy: { submittedAt: "desc" },
        take: ACTIVITY_LIMIT,
        select: {
          submittedAt: true,
          obtainedMarks: true,
          totalMarks: true,
          quiz: { select: { title: true } },
        },
      }),
      this.prisma.xpEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: ACTIVITY_LIMIT,
        select: { createdAt: true, amount: true, reason: true },
      }),
      this.prisma.dailyQuizAttempt.findMany({
        where: { userId, finishedAt: { not: null } },
        orderBy: { finishedAt: "desc" },
        take: 30,
        select: { finishedAt: true, correctCount: true },
      }),
      this.prisma.quizAttemptAnswer.findMany({
        where: { uploadAssetId: { not: null }, attempt: { userId } },
        orderBy: { answeredAt: "desc" },
        take: 30,
        select: { answeredAt: true, question: { select: { text: true } } },
      }),
    ]);
    const items: ProfileActivityItem[] = [
      ...lessons.map((l) => ({
        at: l.completedAt!.toISOString(),
        kind: "LESSON" as const,
        title: `Completed "${l.lesson.title}"`,
        detail: null,
      })),
      ...attempts.map((a) => ({
        at: a.submittedAt!.toISOString(),
        kind: "QUIZ" as const,
        title: `Finished ${a.quiz.title}`,
        detail: `${Number(a.obtainedMarks ?? 0)} / ${Number(a.totalMarks)} marks`,
      })),
      ...xp.map((e) => ({
        at: e.createdAt.toISOString(),
        kind: "XP" as const,
        title: `+${e.amount} XP`,
        detail: XP_REASON_LABEL[e.reason] ?? e.reason,
      })),
      ...daily.map((d) => ({
        at: d.finishedAt!.toISOString(),
        kind: "DAILY_QUIZ" as const,
        title: "Took the daily quiz",
        detail: `${d.correctCount ?? 0} correct`,
      })),
      ...sketches
        .filter((s) => s.answeredAt)
        .map((s) => ({
          at: s.answeredAt!.toISOString(),
          kind: "SKETCH" as const,
          title: "Uploaded a sketch",
          detail: s.question.text.slice(0, 80),
        })),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, ACTIVITY_LIMIT);
  }

  /** First finished attempt of each test in a course (optionally one practice category), oldest first. */
  async performance(
    userId: string,
    courseId: string,
    categoryId?: string,
  ): Promise<ProfilePerformancePoint[]> {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: {
        userId,
        status: { in: [...FINISHED] },
        quiz: {
          subject: { courseId },
          ...(categoryId
            ? { practiceCategoryId: categoryId }
            : { practiceCategoryId: { not: null } }),
        },
      },
      orderBy: { startedAt: "asc" },
      select: {
        id: true,
        quizId: true,
        submittedAt: true,
        totalMarks: true,
        obtainedMarks: true,
        quiz: { select: { title: true } },
        answers: { select: { method: true, marksAwarded: true } },
      },
    });
    const seen = new Set<string>();
    const points: ProfilePerformancePoint[] = [];
    for (const a of attempts) {
      if (seen.has(a.quizId)) continue;
      seen.add(a.quizId);
      const total = Number(a.totalMarks);
      const byMethod: Record<AnswerMethod, number> = { KNOWLEDGE: 0, ELIMINATION: 0, GUESS: 0 };
      for (const ans of a.answers) {
        const m = Number(ans.marksAwarded ?? 0);
        if (m > 0) byMethod[ans.method ?? "KNOWLEDGE"] += m;
      }
      const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);
      points.push({
        attemptId: a.id,
        quizTitle: a.quiz.title,
        submittedAt: a.submittedAt!.toISOString(),
        percent: pct(Number(a.obtainedMarks ?? 0)),
        byMethod: {
          KNOWLEDGE: pct(byMethod.KNOWLEDGE),
          ELIMINATION: pct(byMethod.ELIMINATION),
          GUESS: pct(byMethod.GUESS),
        },
      });
    }
    return points;
  }

  async revision(userId: string): Promise<RevisionItem[]> {
    const flagged = await this.prisma.quizAttemptAnswer.findMany({
      where: { flagged: true, attempt: { userId, status: { in: [...FINISHED] } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        questionId: true,
        attemptId: true,
        question: { select: { text: true } },
        attempt: { select: { quiz: { select: { title: true } } } },
      },
    });
    const wrongByTopic = await this.prisma.quizAttemptAnswer.groupBy({
      by: ["questionId"],
      where: {
        isCorrect: false,
        attempt: { userId, status: { in: [...FINISHED] } },
        question: { topicId: { not: null } },
      },
      _count: { _all: true },
    });
    const studied = new Set(
      (
        await this.prisma.topicStudyMark.findMany({ where: { userId }, select: { topicId: true } })
      ).map((m) => m.topicId),
    );
    const qs = await this.prisma.question.findMany({
      where: { id: { in: wrongByTopic.map((w) => w.questionId) } },
      select: {
        topic: { select: { id: true, title: true, subject: { select: { title: true } } } },
      },
    });
    const topics = new Map<string, RevisionItem>();
    for (const q of qs) {
      if (!q.topic || studied.has(q.topic.id)) continue;
      topics.set(q.topic.id, {
        kind: "WEAK_TOPIC",
        topicId: q.topic.id,
        topicTitle: q.topic.title,
        subjectTitle: q.topic.subject.title,
      });
    }
    return [
      ...flagged.map((f) => ({
        kind: "FLAGGED" as const,
        questionId: f.questionId,
        questionText: f.question.text,
        quizTitle: f.attempt.quiz.title,
        attemptId: f.attemptId,
      })),
      ...topics.values(),
    ];
  }

  async goals(userId: string): Promise<GoalView[]> {
    const courses = await this.licensedCourses(userId);
    const goals = await this.prisma.studentGoal.findMany({ where: { userId } });
    const out: GoalView[] = [];
    for (const c of courses) {
      const goal = goals.find((g) => g.courseId === c.id);
      const recent = (await this.performance(userId, c.id)).slice(-GOAL_RECENT_TESTS);
      out.push({
        courseId: c.id,
        courseTitle: c.title,
        targetPercent: goal?.targetPercent ?? null,
        note: goal?.note ?? null,
        currentPercent:
          recent.length === 0
            ? null
            : Math.round(recent.reduce((s, p) => s + p.percent, 0) / recent.length),
      });
    }
    return out;
  }

  async setGoal(
    userId: string,
    courseId: string,
    targetPercent: number,
    note?: string,
  ): Promise<void> {
    const licensed = (await this.licensedCourses(userId)).some((c) => c.id === courseId);
    if (!licensed) throw new ForbiddenException("You don't have a licence for this course");
    await this.prisma.studentGoal.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, targetPercent, note: note?.trim() || null },
      update: { targetPercent, note: note?.trim() || null },
    });
  }

  async checkpoints(userId: string): Promise<CheckpointView[]> {
    const courseIds = (await this.licensedCourses(userId)).map((c) => c.id);
    const rows = await this.prisma.courseCheckpoint.findMany({
      where: { courseId: { in: courseIds } },
      orderBy: [{ dueDate: "asc" }, { position: "asc" }],
      include: {
        course: { select: { title: true } },
        completions: { where: { userId }, select: { userId: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      courseTitle: r.course.title,
      title: r.title,
      dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
      done: r.completions.length > 0,
    }));
  }

  async setCheckpoint(userId: string, checkpointId: string, done: boolean): Promise<void> {
    const cp = await this.prisma.courseCheckpoint.findUnique({
      where: { id: checkpointId },
      select: { courseId: true },
    });
    if (!cp) throw new NotFoundException("Checkpoint not found");
    const licensed = (await this.licensedCourses(userId)).some((c) => c.id === cp.courseId);
    if (!licensed) throw new ForbiddenException("You don't have a licence for this course");
    if (done) {
      await this.prisma.checkpointCompletion.upsert({
        where: { checkpointId_userId: { checkpointId, userId } },
        create: { checkpointId, userId },
        update: {},
      });
    } else {
      await this.prisma.checkpointCompletion.deleteMany({ where: { checkpointId, userId } });
    }
  }

  // ------------------------------------------------------------ admin

  listCourseCheckpoints(courseId: string) {
    return this.prisma.courseCheckpoint.findMany({
      where: { courseId },
      orderBy: [{ position: "asc" }, { dueDate: "asc" }],
      include: { _count: { select: { completions: true } } },
    });
  }

  async createCheckpoint(courseId: string, title: string, dueDate?: string | null) {
    const course = await this.prisma.course.findFirst({ where: { id: courseId, deletedAt: null } });
    if (!course) throw new NotFoundException("Course not found");
    const last = await this.prisma.courseCheckpoint.findFirst({
      where: { courseId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return this.prisma.courseCheckpoint.create({
      data: {
        courseId,
        title: title.trim(),
        dueDate: dueDate ? new Date(dueDate) : null,
        position: (last?.position ?? -1) + 1,
      },
    });
  }

  async deleteCheckpoint(id: string): Promise<void> {
    const cp = await this.prisma.courseCheckpoint.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!cp) throw new NotFoundException("Checkpoint not found");
    await this.prisma.courseCheckpoint.delete({ where: { id } });
  }

  async listCohorts(): Promise<CohortView[]> {
    const rows = await this.prisma.cohort.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true } } },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      batch: c.batch,
      memberCount: c._count.members,
    }));
  }

  createCohort(name: string, batch?: string) {
    return this.prisma.cohort.create({ data: { name: name.trim(), batch: batch?.trim() || null } });
  }

  async deleteCohort(id: string): Promise<void> {
    const c = await this.prisma.cohort.findUnique({ where: { id }, select: { id: true } });
    if (!c) throw new NotFoundException("Cohort not found");
    await this.prisma.cohort.delete({ where: { id } });
  }

  async cohortMembers(id: string) {
    const c = await this.prisma.cohort.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: { joinedAt: "asc" },
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!c) throw new NotFoundException("Cohort not found");
    return c.members.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: `${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim() || m.user.email,
    }));
  }

  /** Adds students by email; unknown emails are reported back. */
  async addCohortMembers(id: string, emails: string[]) {
    const c = await this.prisma.cohort.findUnique({ where: { id }, select: { id: true } });
    if (!c) throw new NotFoundException("Cohort not found");
    const clean = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (clean.length === 0) throw new BadRequestException("Enter at least one email");
    const users = await this.prisma.user.findMany({
      where: { email: { in: clean, mode: "insensitive" }, deletedAt: null },
      select: { id: true, email: true },
    });
    await this.prisma.cohortMember.createMany({
      data: users.map((u) => ({ cohortId: id, userId: u.id })),
      skipDuplicates: true,
    });
    const found = new Set(users.map((u) => u.email.toLowerCase()));
    return { added: users.length, notFound: clean.filter((e) => !found.has(e)) };
  }

  async removeCohortMember(id: string, userId: string): Promise<void> {
    await this.prisma.cohortMember.deleteMany({ where: { cohortId: id, userId } });
  }
}
