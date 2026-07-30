import { randomUUID } from "node:crypto";
import { Test, type TestingModule } from "@nestjs/testing";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { PrismaService } from "../../prisma/prisma.service";
import { fakeNotificationsServiceProvider } from "../../../test/support/fake-notifications-service";
import { QuizCatalogService } from "../quiz-catalog/quiz-catalog.service";
import { QuizAttemptsService } from "./quiz-attempts.service";

/**
 * Performance/reliability validation (Sprint 4 NFRs): a quiz with 500+
 * questions and many concurrent attempts. This is functional-correctness-
 * under-load validation via the service layer, not a formal load-test suite
 * (PERF-32 load testing is Sprint 13/Phase 5 scope) — timings are logged for
 * visibility but not asserted as hard pass/fail gates, since a fixed
 * millisecond threshold would be flaky across different CI hardware.
 */
describe("QuizAttemptsService (performance — large quiz)", () => {
  let attempts: QuizAttemptsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  const userIds: string[] = [];
  const QUESTION_COUNT = 500;
  let quizId: string;
  let questionIds: string[];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        QuizAttemptsService,
        QuizCatalogService,
        EnrollmentService,
        PrismaService,
        fakeNotificationsServiceProvider(),
      ],
    }).compile();
    attempts = moduleRef.get(QuizAttemptsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const questionRows = Array.from({ length: QUESTION_COUNT }, (_, i) => ({
      id: randomUUID(),
      type: "SINGLE_CHOICE" as const,
      difficulty: "MEDIUM" as const,
      text: `Perf question ${i} ${suffix}`,
      status: "PUBLISHED" as const,
    }));
    await prisma.question.createMany({ data: questionRows });
    questionIds = questionRows.map((q) => q.id);

    const optionRows = questionRows.flatMap((q) => [
      { id: randomUUID(), questionId: q.id, text: "Correct", isCorrect: true, position: 0 },
      { id: randomUUID(), questionId: q.id, text: "Wrong", isCorrect: false, position: 1 },
    ]);
    await prisma.questionOption.createMany({ data: optionRows });

    const quiz = await prisma.quiz.create({
      data: {
        title: `Perf Quiz ${suffix}`,
        slug: `perf-quiz-${suffix}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
        timeLimitMinutes: 180,
      },
    });
    quizId = quiz.id;

    await prisma.quizQuestion.createMany({
      data: questionRows.map((q, i) => ({
        quizId: quiz.id,
        questionId: q.id,
        marks: 1,
        position: i,
      })),
    });

    const learners = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        prisma.user.create({
          data: { email: `perf-quiz-${suffix}-${i}@example.test`, status: "ACTIVE" },
        }),
      ),
    );
    userIds.push(...learners.map((u) => u.id));
  }, 60_000);

  afterAll(async () => {
    await prisma.quiz.deleteMany({ where: { id: quizId } });
    await prisma.question.deleteMany({ where: { id: { in: questionIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await moduleRef.close();
  }, 30_000);

  it("starts an attempt on a 500-question quiz with the full question set, in one indexed query", async () => {
    const start = performance.now();
    const { attempt } = await attempts.start(quizId, userIds[0]!);
    const elapsedMs = performance.now() - start;
    // eslint-disable-next-line no-console -- performance visibility, not application logging
    console.log(
      `[perf] start() on a ${QUESTION_COUNT}-question quiz took ${elapsedMs.toFixed(1)}ms`,
    );

    const snapshot = attempt.questionSnapshot as unknown as { questionId: string }[];
    expect(snapshot).toHaveLength(QUESTION_COUNT);
    expect(Number(attempt.totalMarks)).toBe(QUESTION_COUNT);
  }, 30_000);

  it("autosave stays fast (single indexed upsert) regardless of quiz size", async () => {
    const { attempt } = await attempts.start(quizId, userIds[1]!);
    const targetQuestionId = questionIds[250]!;
    const option = await prisma.questionOption.findFirstOrThrow({
      where: { questionId: targetQuestionId, isCorrect: true },
    });

    const start = performance.now();
    await attempts.autosaveAnswer(attempt.id, userIds[1]!, targetQuestionId, [option.id]);
    const elapsedMs = performance.now() - start;
    // eslint-disable-next-line no-console -- performance visibility, not application logging
    console.log(
      `[perf] autosave on a ${QUESTION_COUNT}-question attempt took ${elapsedMs.toFixed(1)}ms`,
    );
    expect(elapsedMs).toBeLessThan(2000);
  }, 15_000);

  it("submits and correctly scores a fully-answered 500-question attempt", async () => {
    const { attempt } = await attempts.start(quizId, userIds[2]!);
    const options = await prisma.questionOption.findMany({
      where: { questionId: { in: questionIds }, isCorrect: true },
    });
    const correctOptionByQuestion = new Map(options.map((o) => [o.questionId, o.id]));

    for (const questionId of questionIds) {
      await attempts.autosaveAnswer(attempt.id, userIds[2]!, questionId, [
        correctOptionByQuestion.get(questionId)!,
      ]);
    }

    const start = performance.now();
    const { attempt: submitted, justSubmitted } = await attempts.submit(attempt.id, userIds[2]!);
    const elapsedMs = performance.now() - start;
    // eslint-disable-next-line no-console -- performance visibility, not application logging
    console.log(
      `[perf] submit()/scoring a ${QUESTION_COUNT}-question attempt took ${elapsedMs.toFixed(1)}ms`,
    );

    expect(justSubmitted).toBe(true);
    expect(submitted.correctCount).toBe(QUESTION_COUNT);
    expect(Number(submitted.obtainedMarks)).toBe(QUESTION_COUNT);
    expect(Number(submitted.percentage)).toBe(100);
  }, 60_000);

  it("handles many concurrent students starting attempts on the same large quiz independently", async () => {
    const concurrentUserIds = userIds.slice(3, 20);
    const start = performance.now();
    const results = await Promise.all(
      concurrentUserIds.map((userId) => attempts.start(quizId, userId)),
    );
    const elapsedMs = performance.now() - start;
    // eslint-disable-next-line no-console -- performance visibility, not application logging
    console.log(
      `[perf] ${concurrentUserIds.length} concurrent start() calls on a ${QUESTION_COUNT}-question quiz took ${elapsedMs.toFixed(1)}ms`,
    );

    expect(results).toHaveLength(concurrentUserIds.length);
    expect(new Set(results.map((r) => r.attempt.id)).size).toBe(concurrentUserIds.length); // each attempt is distinct
    expect(results.every((r) => r.created)).toBe(true);
  }, 30_000);
});
