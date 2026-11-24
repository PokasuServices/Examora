import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  MarkingRow,
  PracticeCategoryView,
  PracticeOverview,
  PracticeTestDetail,
  PracticeTestItem,
  PracticeTestSection,
  QuestionType,
  WeakTopicAction,
} from "@examora/types";
import { PrismaService } from "../prisma/prisma.service";

const PUBLISHED = { status: "PUBLISHED" as const, deletedAt: null };
const FINISHED = ["SUBMITTED", "AUTO_SUBMITTED"] as const;
/** Topics with at least this many knowledge-based wrong answers are surfaced as "needs attention". */
const WEAK_MIN_WRONG = 1;
const WEAK_LIMIT = 6;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "category";

/** Practice page: categories of tests per course (student module redesign, phase 4). */
interface MarkingInput {
  sectionId: string | null;
  type: QuestionType;
  partialMarking: boolean;
  marks: number;
  negative: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Groups questions by type and marks into marking-scheme rows. */
export function markingRows(questions: MarkingInput[]): MarkingRow[] {
  const rows = new Map<string, MarkingRow>();
  for (const q of questions) {
    // Sketch questions are marked by a reviewer and never lose marks.
    const negative = q.type === "UPLOAD" ? 0 : round2(q.negative);
    const partial = q.type === "MULTIPLE_CHOICE" && q.partialMarking;
    const key = `${q.type}|${q.marks}|${negative}|${partial}`;
    const row = rows.get(key);
    if (row) row.questionCount++;
    else
      rows.set(key, {
        type: q.type,
        questionCount: 1,
        marksEach: round2(q.marks),
        negativeEach: negative,
        partialMarking: partial,
      });
  }
  return [...rows.values()];
}

/** Test sections with instructions and marking schemes (one implicit section if none). */
export function buildSections(
  sections: {
    id: string;
    title: string;
    description: string | null;
    timeLimitMinutes?: number | null;
  }[],
  questions: MarkingInput[],
): PracticeTestSection[] {
  const summarise = (qs: MarkingInput[]) => ({
    questionCount: qs.length,
    totalMarks: round2(qs.reduce((t, q) => t + q.marks, 0)),
    marking: markingRows(qs),
  });
  if (sections.length === 0) {
    return [
      {
        id: null,
        title: "All questions",
        description: null,
        timeLimitMinutes: null,
        ...summarise(questions),
      },
    ];
  }
  const out: PracticeTestSection[] = sections.map((sec) => ({
    id: sec.id,
    title: sec.title,
    description: sec.description,
    timeLimitMinutes: sec.timeLimitMinutes ?? null,
    ...summarise(questions.filter((q) => q.sectionId === sec.id)),
  }));
  const loose = questions.filter(
    (q) => !q.sectionId || !sections.some((x) => x.id === q.sectionId),
  );
  if (loose.length > 0) {
    out.push({
      id: null,
      title: "Other questions",
      description: null,
      timeLimitMinutes: null,
      ...summarise(loose),
    });
  }
  return out;
}

/**
 * Past papers (tests with a year) list newest year first; tests without a
 * year keep the admin's order after them.
 */
export function sortPapers(tests: PracticeTestItem[]): PracticeTestItem[] {
  if (!tests.some((t) => t.paperYear !== null)) return tests;
  return tests
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (b.t.paperYear ?? -1) - (a.t.paperYear ?? -1) || a.i - b.i)
    .map(({ t }) => t);
}

@Injectable()
export class PracticeService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertLicence(userId: string, courseId: string): Promise<void> {
    const e = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { status: true, expiresAt: true },
    });
    const ok = e?.status === "ACTIVE" && (e.expiresAt === null || e.expiresAt > new Date());
    if (!ok) throw new ForbiddenException("You don't have a licence for this course");
  }

  /** Test rows for a set of quizzes, with the caller's attempts and lock state. */
  private async testItems(
    userId: string,
    quizIds: string[],
  ): Promise<Map<string, PracticeTestItem>> {
    const items = new Map<string, PracticeTestItem>();
    if (quizIds.length === 0) return items;
    const [quizzes, attempts] = await Promise.all([
      this.prisma.quiz.findMany({
        where: { id: { in: quizIds } },
        include: {
          quizQuestions: { select: { marks: true } },
          _count: { select: { sections: true } },
          unlockAfter: { select: { id: true, title: true } },
        },
      }),
      this.prisma.quizAttempt.findMany({
        where: { userId, quizId: { in: quizIds } },
        orderBy: { startedAt: "desc" },
        select: { id: true, quizId: true, status: true, obtainedMarks: true, totalMarks: true },
      }),
    ]);
    const unlockIds = quizzes.map((q) => q.unlockAfterQuizId).filter((id): id is string => !!id);
    const unlockDone = new Set(
      (
        await this.prisma.quizAttempt.findMany({
          where: { userId, quizId: { in: unlockIds }, status: { in: [...FINISHED] } },
          select: { quizId: true },
          distinct: ["quizId"],
        })
      ).map((a) => a.quizId),
    );
    for (const q of quizzes) {
      const mine = attempts.filter((a) => a.quizId === q.id);
      const lastFinished = mine.find((a) => a.status !== "IN_PROGRESS");
      items.set(q.id, {
        id: q.id,
        title: q.title,
        description: q.description,
        exam: q.exam,
        paperYear: q.paperYear,
        note: q.note,
        perfectBonusXp: q.perfectBonusXp,
        questionCount: q.quizQuestions.length,
        totalMarks: q.quizQuestions.reduce((sum, qq) => sum + Number(qq.marks), 0),
        timeLimitMinutes: q.timeLimitMinutes,
        xpReward: q.xpReward,
        maxAttempts: q.maxAttempts,
        attemptsUsed: mine.length,
        sectionCount: q._count.sections,
        lastScore: lastFinished
          ? {
              obtained: Number(lastFinished.obtainedMarks ?? 0),
              total: Number(lastFinished.totalMarks),
              attemptId: lastFinished.id,
            }
          : null,
        inProgressAttemptId: mine.find((a) => a.status === "IN_PROGRESS")?.id ?? null,
        lockedBy:
          q.unlockAfter && !unlockDone.has(q.unlockAfter.id)
            ? { id: q.unlockAfter.id, title: q.unlockAfter.title }
            : null,
      });
    }
    return items;
  }

  async overview(userId: string, courseId: string): Promise<PracticeOverview> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, ...PUBLISHED },
      select: {
        id: true,
        title: true,
        practiceCategories: {
          orderBy: { position: "asc" },
          include: {
            quizzes: { where: PUBLISHED, orderBy: { position: "asc" }, select: { id: true } },
          },
        },
      },
    });
    if (!course) throw new NotFoundException("Course not found");
    await this.assertLicence(userId, courseId);

    const items = await this.testItems(
      userId,
      course.practiceCategories.flatMap((c) => c.quizzes.map((q) => q.id)),
    );
    const categories: PracticeCategoryView[] = course.practiceCategories.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      tests: sortPapers(c.quizzes.map((q) => items.get(q.id)!).filter(Boolean)),
    }));
    return {
      course: { id: course.id, title: course.title },
      categories,
      weakTopics: await this.weakTopics(userId, courseId),
    };
  }

  /**
   * Topics where the student answered from "knowledge" and was wrong, across
   * their finished attempts in this course, minus topics they've marked studied.
   */
  async weakTopics(userId: string, courseId: string): Promise<WeakTopicAction[]> {
    const answers = await this.prisma.quizAttemptAnswer.findMany({
      where: {
        attempt: { userId, status: { in: [...FINISHED] } },
        isCorrect: { not: null },
        question: { topic: { subject: { courseId } } },
      },
      select: {
        isCorrect: true,
        method: true,
        question: {
          select: {
            topicId: true,
            topic: { select: { title: true, subject: { select: { title: true } } } },
          },
        },
      },
    });
    const studied = new Set(
      (
        await this.prisma.topicStudyMark.findMany({ where: { userId }, select: { topicId: true } })
      ).map((m) => m.topicId),
    );
    const byTopic = new Map<string, WeakTopicAction>();
    for (const a of answers) {
      const topicId = a.question.topicId;
      if (!topicId || !a.question.topic || studied.has(topicId)) continue;
      const t = byTopic.get(topicId) ?? {
        topicId,
        topicTitle: a.question.topic.title,
        subjectTitle: a.question.topic.subject.title,
        answered: 0,
        wrongFromKnowledge: 0,
      };
      t.answered += 1;
      if (a.isCorrect === false && (a.method ?? "KNOWLEDGE") === "KNOWLEDGE")
        t.wrongFromKnowledge += 1;
      byTopic.set(topicId, t);
    }
    return [...byTopic.values()]
      .filter((t) => t.wrongFromKnowledge >= WEAK_MIN_WRONG)
      .sort((a, b) => b.wrongFromKnowledge - a.wrongFromKnowledge)
      .slice(0, WEAK_LIMIT);
  }

  async markStudied(userId: string, topicId: string, studied: boolean): Promise<void> {
    const topic = await this.prisma.topic.findFirst({
      where: { id: topicId, deletedAt: null },
      select: { id: true },
    });
    if (!topic) throw new NotFoundException("Topic not found");
    if (studied) {
      await this.prisma.topicStudyMark.upsert({
        where: { userId_topicId: { userId, topicId } },
        create: { userId, topicId },
        update: { markedAt: new Date() },
      });
    } else {
      await this.prisma.topicStudyMark.deleteMany({ where: { userId, topicId } });
    }
  }

  async testDetail(userId: string, quizId: string): Promise<PracticeTestDetail> {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: quizId, ...PUBLISHED },
      include: {
        practiceCategory: { select: { id: true, title: true } },
        subject: { select: { course: { select: { id: true, title: true } } } },
        sections: {
          orderBy: { position: "asc" },
          select: { id: true, title: true, description: true, timeLimitMinutes: true },
        },
        quizQuestions: {
          orderBy: { position: "asc" },
          select: {
            sectionId: true,
            marks: true,
            negativeMarks: true,
            question: { select: { type: true, partialMarking: true } },
          },
        },
      },
    });
    if (!quiz) throw new NotFoundException("Test not found");
    const course = quiz.subject?.course;
    if (!course) throw new NotFoundException("Test not found");
    await this.assertLicence(userId, course.id);
    const item = (await this.testItems(userId, [quiz.id])).get(quiz.id)!;
    return {
      ...item,
      crumbs: { course, category: quiz.practiceCategory },
      sections: buildSections(
        quiz.sections,
        quiz.quizQuestions.map((qq) => ({
          sectionId: qq.sectionId,
          type: qq.question.type as QuestionType,
          partialMarking: qq.question.partialMarking,
          marks: Number(qq.marks),
          negative:
            qq.negativeMarks !== null
              ? Number(qq.negativeMarks)
              : quiz.negativeMarkingEnabled
                ? Number(qq.marks) * Number(quiz.negativeMarksPerWrong)
                : 0,
        })),
      ),
      negativeMarking: quiz.negativeMarkingEnabled,
      requireAllVisited: quiz.requireAllVisited,
    };
  }

  // ------------------------------------------------------------------ admin

  async listCategories(courseId: string) {
    return this.prisma.practiceCategory.findMany({
      where: { courseId },
      orderBy: { position: "asc" },
      include: { _count: { select: { quizzes: true } } },
    });
  }

  async createCategory(
    courseId: string,
    dto: { title: string; description?: string; position?: number },
  ) {
    const course = await this.prisma.course.findFirst({ where: { id: courseId, deletedAt: null } });
    if (!course) throw new NotFoundException("Course not found");
    let slug = slugify(dto.title);
    for (
      let i = 2;
      await this.prisma.practiceCategory.findUnique({
        where: { courseId_slug: { courseId, slug } },
      });
      i++
    ) {
      slug = `${slugify(dto.title)}-${i}`;
    }
    const last = await this.prisma.practiceCategory.findFirst({
      where: { courseId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return this.prisma.practiceCategory.create({
      data: {
        courseId,
        title: dto.title.trim(),
        slug,
        description: dto.description,
        position: dto.position ?? (last?.position ?? -1) + 1,
      },
    });
  }

  async updateCategory(
    id: string,
    dto: { title?: string; description?: string | null; position?: number },
  ) {
    await this.findCategory(id);
    return this.prisma.practiceCategory.update({
      where: { id },
      data: { title: dto.title?.trim(), description: dto.description, position: dto.position },
    });
  }

  async deleteCategory(id: string): Promise<void> {
    await this.findCategory(id);
    // Tests in the category stay; they just stop being listed on Practice.
    await this.prisma.practiceCategory.delete({ where: { id } });
  }

  private async findCategory(id: string) {
    const c = await this.prisma.practiceCategory.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("Category not found");
    return c;
  }
}
