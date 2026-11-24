import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { QuizCatalogService } from "../assessment/quiz-catalog/quiz-catalog.service";
import { QuizAttemptsService } from "../assessment/quiz-attempts/quiz-attempts.service";
import { DailyQuizService, todayInIndia } from "../daily-quiz/daily-quiz.service";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { XpService } from "../gamification/xp.service";
import { PrismaService } from "../prisma/prisma.service";
import { fakeNotificationsServiceProvider } from "../../test/support/fake-notifications-service";
import { PracticeService } from "./practice.service";

/**
 * Student module rules (phases 4 & 7): tests unlock in order, a test that
 * requires it can't be submitted until every question was opened, test-screen
 * metadata is recorded, cohort licences, and the daily quiz's one-try/XP rules.
 */
describe("Practice, attempt rules and daily quiz (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let attempts: QuizAttemptsService;
  let practice: PracticeService;
  let daily: DailyQuizService;
  let enrollment: EnrollmentService;
  let xp: XpService;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let userId: string;
  let courseId: string;
  let firstQuiz: string;
  let secondQuiz: string;
  const questionIds: string[] = [];
  let cohortId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        QuizAttemptsService,
        QuizCatalogService,
        EnrollmentService,
        PracticeService,
        DailyQuizService,
        XpService,
        PrismaService,
        fakeNotificationsServiceProvider(),
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    attempts = moduleRef.get(QuizAttemptsService);
    practice = moduleRef.get(PracticeService);
    daily = moduleRef.get(DailyQuizService);
    enrollment = moduleRef.get(EnrollmentService);
    xp = moduleRef.get(XpService);
    await prisma.$connect();

    const user = await prisma.user.create({
      data: { email: `rules-${suffix}@example.test`, status: "ACTIVE" },
    });
    userId = user.id;
    const course = await prisma.course.create({
      data: {
        title: "Rules course",
        slug: `rules-${suffix}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
    courseId = course.id;
    const subject = await prisma.subject.create({
      data: { courseId, title: "S", slug: "s", status: "PUBLISHED" },
    });
    const category = await prisma.practiceCategory.create({
      data: { courseId, title: "Mock tests", slug: "mock-tests" },
    });
    for (let i = 0; i < 2; i++) {
      const q = await prisma.question.create({
        data: {
          subjectId: subject.id,
          type: "SINGLE_CHOICE",
          text: `Q${i}`,
          status: "PUBLISHED",
          options: {
            create: [
              { text: "a", isCorrect: true, position: 0 },
              { text: "b", isCorrect: false, position: 1 },
            ],
          },
        },
      });
      questionIds.push(q.id);
    }
    const mk = async (title: string, unlockAfterQuizId: string | null) =>
      (
        await prisma.quiz.create({
          data: {
            subjectId: subject.id,
            practiceCategoryId: category.id,
            unlockAfterQuizId,
            requireAllVisited: true,
            title,
            slug: `rules-${title.replace(/\s/g, "-")}-${suffix}`.toLowerCase(),
            status: "PUBLISHED",
            publishedAt: new Date(),
            quizQuestions: {
              create: questionIds.map((questionId, position) => ({ questionId, position })),
            },
          },
        })
      ).id;
    firstQuiz = await mk("Test 1", null);
    secondQuiz = await mk("Test 2", firstQuiz);
    const cohort = await prisma.cohort.create({ data: { name: `Rules ${suffix}` } });
    cohortId = cohort.id;
    await prisma.cohortMember.create({ data: { cohortId, userId } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.cohort.deleteMany({ where: { id: cohortId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.question.deleteMany({ where: { id: { in: questionIds } } });
    await moduleRef.close();
  });

  it("needs a licence; a cohort grant provides it", async () => {
    await expect(attempts.start(firstQuiz, userId)).rejects.toBeInstanceOf(ForbiddenException);
    const r = await enrollment.adminBulkGrant({ courseIds: [courseId], cohortId });
    expect(r).toMatchObject({ students: 1, changed: 1 });
  });

  it("keeps Test 2 locked until Test 1 is finished, and lists the lock on Practice", async () => {
    const overview = await practice.overview(userId, courseId);
    const tests = overview.categories[0]!.tests;
    expect(tests.map((t) => t.lockedBy?.title ?? null)).toEqual([null, "Test 1"]);
    await expect(attempts.start(secondQuiz, userId)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("blocks submit until every question was opened, and records meta", async () => {
    const { attempt } = await attempts.start(firstQuiz, userId);
    await attempts.updateQuestionMeta(attempt.id, userId, questionIds[0]!, {
      visited: true,
      flagged: true,
      method: "GUESS",
      addSeconds: 900,
    });
    await expect(attempts.submit(attempt.id, userId)).rejects.toBeInstanceOf(BadRequestException);

    const row = await prisma.quizAttemptAnswer.findUniqueOrThrow({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: questionIds[0]! } },
    });
    expect(row).toMatchObject({ flagged: true, method: "GUESS", timeSpentSeconds: 600 });

    await attempts.updateQuestionMeta(attempt.id, userId, questionIds[1]!, { visited: true });
    const { attempt: done } = await attempts.submit(attempt.id, userId);
    expect(done.status).toBe("SUBMITTED");

    // Test 2 is now unlocked.
    const overview = await practice.overview(userId, courseId);
    expect(overview.categories[0]!.tests[1]!.lockedBy).toBeNull();
    await expect(attempts.start(secondQuiz, userId)).resolves.toBeDefined();
  });

  it("daily quiz: one try, XP once, time capped by real elapsed time", async () => {
    // Make sure today's pool includes our questions.
    await prisma.question.updateMany({
      where: { id: { in: questionIds } },
      data: { tags: ["daily"] },
    });
    const date = todayInIndia();
    const existing = await prisma.dailyQuiz.findUnique({ where: { date } });
    if (!existing) await prisma.dailyQuiz.create({ data: { date, questionIds } });

    const before = await xp.getTotal(userId);
    const questions = await daily.start(userId);
    expect(questions.length).toBeGreaterThan(0);
    const result = await daily.finish(
      userId,
      questions.map((q) => ({ questionId: q.questionId, optionId: q.options[0]!.id, ms: 100 })),
    );
    expect(result.total).toBe(questions.length);
    expect(result.totalMs).toBeLessThanOrEqual(questions.length * 100);
    expect(await xp.getTotal(userId)).toBe(before + result.xpAwarded);
    await expect(daily.start(userId)).rejects.toBeInstanceOf(ConflictException);
    const status = await daily.status(userId);
    expect(status.attempt?.correctCount).toBe(result.correctCount);
    expect(status.attemptedCount).toBeGreaterThanOrEqual(1);
  });
});
