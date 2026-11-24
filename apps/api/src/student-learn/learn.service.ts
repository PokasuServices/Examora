import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  LearnCourseOption,
  LearnCourseOverview,
  LearnCrumbs,
  LearnLessonDetail,
  LearnQuizInfo,
  LearnSubjectCard,
  LearnSubjectDetail,
  LearnTopicDetail,
  SubjectKind,
  SyllabusHeatmap,
  TopicRatingValue,
} from "@examora/types";
import { PrismaService } from "../prisma/prisma.service";
import { LessonQuestionsService } from "./lesson-questions.service";

const PUBLISHED = { status: "PUBLISHED" as const, deletedAt: null };
const BY_POSITION = { position: "asc" as const };
const MAX_SUGGESTIONS = 3;

/** Lessons + quizzes of one topic, reduced to ids (enough to compute progress). */
interface TopicItems {
  lessonIds: string[];
  quizIds: string[];
}

/** done / total as a whole percentage; an empty topic counts as 0%. */
export function percentOf(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/**
 * Student "Learn" section (student module redesign). Every endpoint requires
 * an active licence (enrollment) for the course, whatever its price: students
 * don't buy courses, an administrator assigns them.
 */
@Injectable()
export class LearnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessonQuestions: LessonQuestionsService,
  ) {}

  // ---------------------------------------------------------------- licences

  async listMyCourses(userId: string): Promise<LearnCourseOption[]> {
    const now = new Date();
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        course: PUBLISHED,
      },
      include: { course: { select: { id: true, title: true, examType: true, position: true } } },
    });
    return enrollments
      .map((e) => e.course)
      .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title))
      .map(({ id, title, examType }) => ({ id, title, examType }));
  }

  private async assertLicence(userId: string, courseId: string): Promise<void> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { status: true, expiresAt: true },
    });
    const active =
      enrollment?.status === "ACTIVE" &&
      (enrollment.expiresAt === null || enrollment.expiresAt > new Date());
    if (!active) {
      throw new ForbiddenException("You don't have a licence for this course");
    }
  }

  // ---------------------------------------------------------------- progress

  private async completedLessonIds(userId: string, lessonIds: string[]): Promise<Set<string>> {
    if (lessonIds.length === 0) return new Set();
    const rows = await this.prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } },
      select: { lessonId: true },
    });
    return new Set(rows.map((r) => r.lessonId));
  }

  /** Attempt counts per quiz: all attempts (for "attempts used") and finished ones (for progress). */
  private async attemptCounts(
    userId: string,
    quizIds: string[],
  ): Promise<{ used: Map<string, number>; finished: Map<string, number> }> {
    const used = new Map<string, number>();
    const finished = new Map<string, number>();
    if (quizIds.length === 0) return { used, finished };
    const rows = await this.prisma.quizAttempt.groupBy({
      by: ["quizId", "status"],
      where: { userId, quizId: { in: quizIds } },
      _count: { _all: true },
    });
    for (const r of rows) {
      used.set(r.quizId, (used.get(r.quizId) ?? 0) + r._count._all);
      if (r.status !== "IN_PROGRESS") {
        finished.set(r.quizId, (finished.get(r.quizId) ?? 0) + r._count._all);
      }
    }
    return { used, finished };
  }

  private topicProgress(
    items: TopicItems,
    completed: Set<string>,
    finished: Map<string, number>,
  ): { done: number; total: number } {
    const done =
      items.lessonIds.filter((id) => completed.has(id)).length +
      items.quizIds.filter((id) => (finished.get(id) ?? 0) > 0).length;
    return { done, total: items.lessonIds.length + items.quizIds.length };
  }

  /** Published lessons (via modules) and published topic quizzes for a set of topics. */
  private async loadTopicItems(topicIds: string[]): Promise<Map<string, TopicItems>> {
    const byTopic = new Map<string, TopicItems>(
      topicIds.map((id) => [id, { lessonIds: [], quizIds: [] }]),
    );
    if (topicIds.length === 0) return byTopic;
    const [lessons, quizzes] = await Promise.all([
      this.prisma.lesson.findMany({
        where: { ...PUBLISHED, module: { ...PUBLISHED, topicId: { in: topicIds } } },
        select: { id: true, module: { select: { topicId: true } } },
      }),
      this.prisma.quiz.findMany({
        where: { ...PUBLISHED, topicId: { in: topicIds } },
        select: { id: true, topicId: true },
      }),
    ]);
    for (const l of lessons) byTopic.get(l.module.topicId)?.lessonIds.push(l.id);
    for (const q of quizzes) if (q.topicId) byTopic.get(q.topicId)?.quizIds.push(q.id);
    return byTopic;
  }

  // ---------------------------------------------------------------- course

  async getCourseOverview(userId: string, courseId: string): Promise<LearnCourseOverview> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, ...PUBLISHED },
      include: {
        subjects: {
          where: PUBLISHED,
          orderBy: BY_POSITION,
          include: { topics: { where: PUBLISHED, orderBy: BY_POSITION } },
        },
      },
    });
    if (!course) throw new NotFoundException("Course not found");
    await this.assertLicence(userId, courseId);

    const topicIds = course.subjects.flatMap((s) => s.topics.map((t) => t.id));
    const items = await this.loadTopicItems(topicIds);
    const all = [...items.values()];
    const [completed, { finished }] = await Promise.all([
      this.completedLessonIds(
        userId,
        all.flatMap((i) => i.lessonIds),
      ),
      this.attemptCounts(
        userId,
        all.flatMap((i) => i.quizIds),
      ),
    ]);

    const subjects: LearnSubjectCard[] = course.subjects.map((s) => {
      let done = 0;
      let total = 0;
      let topicsDone = 0;
      for (const t of s.topics) {
        const p = this.topicProgress(items.get(t.id)!, completed, finished);
        done += p.done;
        total += p.total;
        if (p.total > 0 && p.done === p.total) topicsDone++;
      }
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        kind: (s.kind === "ESSENTIALS" ? "ESSENTIALS" : "SUBJECT") as SubjectKind,
        icon: s.icon,
        color: s.color,
        topicsTotal: s.topics.length,
        topicsDone,
        percent: percentOf(done, total),
        topics: s.topics.map((t) => ({ id: t.id, title: t.title })),
      };
    });

    return {
      course: {
        id: course.id,
        title: course.title,
        examType: course.examType,
        nextExamDate: course.nextExamDate?.toISOString() ?? null,
      },
      subjects,
      heatmaps: await this.buildHeatmaps(courseId),
    };
  }

  private async buildHeatmaps(courseId: string): Promise<SyllabusHeatmap[]> {
    const stats = await this.prisma.pastPaperStat.findMany({
      where: { courseId },
      include: { subject: { select: { id: true, title: true, position: true } } },
    });
    const byExam = new Map<string, typeof stats>();
    for (const s of stats) byExam.set(s.examLabel, [...(byExam.get(s.examLabel) ?? []), s]);
    return [...byExam.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([examLabel, rows]) => {
        const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
        const subjectMap = new Map<
          string,
          {
            subjectId: string;
            subjectTitle: string;
            position: number;
            counts: Record<string, number>;
          }
        >();
        for (const r of rows) {
          const entry = subjectMap.get(r.subjectId) ?? {
            subjectId: r.subject.id,
            subjectTitle: r.subject.title,
            position: r.subject.position,
            counts: {},
          };
          entry.counts[String(r.year)] = r.questionCount;
          subjectMap.set(r.subjectId, entry);
        }
        return {
          examLabel,
          years,
          rows: [...subjectMap.values()]
            .sort((a, b) => a.position - b.position)
            .map(({ subjectId, subjectTitle, counts }) => ({ subjectId, subjectTitle, counts })),
        };
      });
  }

  // ---------------------------------------------------------------- subject

  async getSubject(userId: string, subjectId: string): Promise<LearnSubjectDetail> {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, ...PUBLISHED, course: PUBLISHED },
      include: {
        course: { select: { id: true, title: true } },
        topics: { where: PUBLISHED, orderBy: BY_POSITION },
      },
    });
    if (!subject) throw new NotFoundException("Subject not found");
    await this.assertLicence(userId, subject.course.id);

    const items = await this.loadTopicItems(subject.topics.map((t) => t.id));
    const all = [...items.values()];
    const [completed, { finished }] = await Promise.all([
      this.completedLessonIds(
        userId,
        all.flatMap((i) => i.lessonIds),
      ),
      this.attemptCounts(
        userId,
        all.flatMap((i) => i.quizIds),
      ),
    ]);

    return {
      subject: {
        id: subject.id,
        title: subject.title,
        description: subject.description,
        kind: subject.kind === "ESSENTIALS" ? "ESSENTIALS" : "SUBJECT",
      },
      crumbs: { course: subject.course, subject: { id: subject.id, title: subject.title } },
      topics: subject.topics.map((t, i) => {
        const p = this.topicProgress(items.get(t.id)!, completed, finished);
        return {
          id: t.id,
          title: t.title,
          description: t.description,
          position: i + 1,
          percent: percentOf(p.done, p.total),
        };
      }),
    };
  }

  // ---------------------------------------------------------------- topic

  private async loadTopic(topicId: string) {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, ...PUBLISHED, subject: { ...PUBLISHED, course: PUBLISHED } },
      include: { subject: { include: { course: { select: { id: true, title: true } } } } },
    });
    if (!topic) throw new NotFoundException("Topic not found");
    return topic;
  }

  private crumbsFor(topic: Awaited<ReturnType<LearnService["loadTopic"]>>): LearnCrumbs {
    return {
      course: topic.subject.course,
      subject: { id: topic.subject.id, title: topic.subject.title },
      topic: { id: topic.id, title: topic.title },
    };
  }

  /** Published lessons of a topic in reading order (module position, then lesson position). */
  private async topicLessons(topicId: string) {
    return this.prisma.lesson.findMany({
      where: { ...PUBLISHED, module: { ...PUBLISHED, topicId } },
      orderBy: [{ module: { position: "asc" } }, { position: "asc" }],
      select: { id: true, title: true, xpReward: true },
    });
  }

  async getTopic(userId: string, topicId: string): Promise<LearnTopicDetail> {
    const topic = await this.loadTopic(topicId);
    await this.assertLicence(userId, topic.subject.course.id);

    const [lessons, quizzes, rating] = await Promise.all([
      this.topicLessons(topicId),
      this.prisma.quiz.findMany({
        where: { ...PUBLISHED, topicId },
        orderBy: BY_POSITION,
        select: { id: true, title: true, maxAttempts: true, level: true, xpReward: true },
      }),
      this.prisma.topicRating.findUnique({
        where: { userId_topicId: { userId, topicId } },
        select: { rating: true },
      }),
    ]);
    const [completed, { used, finished }] = await Promise.all([
      this.completedLessonIds(
        userId,
        lessons.map((l) => l.id),
      ),
      this.attemptCounts(
        userId,
        quizzes.map((q) => q.id),
      ),
    ]);

    const lessonRows = lessons.map((l) => ({ ...l, completed: completed.has(l.id) }));
    const quizRows = quizzes.map((q) => ({
      ...q,
      attemptsUsed: used.get(q.id) ?? 0,
      attempted: (finished.get(q.id) ?? 0) > 0,
    }));
    const suggestions = [
      ...lessonRows
        .filter((l) => !l.completed)
        .map((l) => ({ kind: "lesson" as const, id: l.id, title: l.title })),
      ...quizRows
        .filter((q) => !q.attempted)
        .map((q) => ({ kind: "quiz" as const, id: q.id, title: q.title })),
    ].slice(0, MAX_SUGGESTIONS);

    return {
      topic: { id: topic.id, title: topic.title, description: topic.description },
      crumbs: this.crumbsFor(topic),
      lessons: lessonRows,
      quizzes: quizRows,
      myRating: (rating?.rating ?? null) as TopicRatingValue | null,
      suggestions,
    };
  }

  async rateTopic(userId: string, topicId: string, rating: TopicRatingValue): Promise<void> {
    const topic = await this.loadTopic(topicId);
    await this.assertLicence(userId, topic.subject.course.id);
    await this.prisma.topicRating.upsert({
      where: { userId_topicId: { userId, topicId } },
      create: { userId, topicId, rating },
      update: { rating },
    });
  }

  // ---------------------------------------------------------------- lesson

  async getLesson(userId: string, lessonId: string): Promise<LearnLessonDetail> {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        ...PUBLISHED,
        module: {
          ...PUBLISHED,
          topic: { ...PUBLISHED, subject: { ...PUBLISHED, course: PUBLISHED } },
        },
      },
      include: { module: { select: { topicId: true } } },
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
    const topic = await this.loadTopic(lesson.module.topicId);
    await this.assertLicence(userId, topic.subject.course.id);

    const [siblings, progress, practiceQuestions] = await Promise.all([
      this.topicLessons(topic.id),
      this.prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
        select: { completedAt: true },
      }),
      this.lessonQuestions.forStudent(userId, lessonId),
    ]);
    const index = siblings.findIndex((l) => l.id === lessonId);

    return {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        contentType: lesson.contentType,
        body: lesson.body,
        contentUrl: lesson.contentUrl,
        xpReward: lesson.xpReward,
        completed: progress?.completedAt != null,
      },
      crumbs: this.crumbsFor(topic),
      previousLessonId: index > 0 ? siblings[index - 1]!.id : null,
      nextLessonId: index >= 0 && index < siblings.length - 1 ? siblings[index + 1]!.id : null,
      practiceQuestions,
    };
  }

  /** Licence check for lesson completion (the completion itself is ProgressService's). */
  async assertLessonLicence(userId: string, lessonId: string): Promise<void> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
      select: {
        module: { select: { topic: { select: { subject: { select: { courseId: true } } } } } },
      },
    });
    if (!lesson) throw new NotFoundException("Lesson not found");
    await this.assertLicence(userId, lesson.module.topic.subject.courseId);
  }

  // ---------------------------------------------------------------- quiz info

  async getQuizInfo(userId: string, quizId: string): Promise<LearnQuizInfo> {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: quizId, ...PUBLISHED },
      include: { _count: { select: { quizQuestions: true } } },
    });
    if (!quiz) throw new NotFoundException("Quiz not found");

    let crumbs: LearnCrumbs;
    if (quiz.topicId) {
      const topic = await this.loadTopic(quiz.topicId);
      await this.assertLicence(userId, topic.subject.course.id);
      crumbs = this.crumbsFor(topic);
    } else {
      const subject = quiz.subjectId
        ? await this.prisma.subject.findUnique({
            where: { id: quiz.subjectId },
            include: { course: { select: { id: true, title: true } } },
          })
        : null;
      if (!subject) throw new NotFoundException("Quiz not found");
      await this.assertLicence(userId, subject.course.id);
      crumbs = { course: subject.course, subject: { id: subject.id, title: subject.title } };
    }

    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId, quizId },
      orderBy: { startedAt: "desc" },
      select: { id: true, status: true },
    });
    const inProgress = attempts.find((a) => a.status === "IN_PROGRESS");
    const lastFinished = attempts.find((a) => a.status !== "IN_PROGRESS");

    return {
      quiz: {
        id: quiz.id,
        title: quiz.title,
        questionCount: quiz._count.quizQuestions,
        maxAttempts: quiz.maxAttempts,
        xpReward: quiz.xpReward,
        level: quiz.level,
        timeLimitMinutes: quiz.timeLimitMinutes,
        doublesOnPerfect: quiz.topicId !== null,
      },
      crumbs,
      attemptsUsed: attempts.length,
      inProgressAttemptId: inProgress?.id ?? null,
      lastFinishedAttemptId: lastFinished?.id ?? null,
    };
  }
}
