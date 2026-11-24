import { BadRequestException, ConflictException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { PrismaService } from "../../prisma/prisma.service";
import { fakeNotificationsServiceProvider } from "../../../test/support/fake-notifications-service";
import { toAttemptState } from "../assessment.mappers";
import { QuizCatalogService } from "../quiz-catalog/quiz-catalog.service";
import { QuizAttemptsService } from "./quiz-attempts.service";

/** Part A and Part B on their own clocks: order, hidden/closed sections, moving on, time-outs. */
describe("Timed-by-section attempts (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let attempts: QuizAttemptsService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let userId: string;
  let courseId: string;
  let quizId: string;
  let qA: string;
  let qB: string;
  let optA: string;

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
    prisma = moduleRef.get(PrismaService);
    attempts = moduleRef.get(QuizAttemptsService);
    await prisma.$connect();

    userId = (
      await prisma.user.create({ data: { email: `st-${suffix}@example.test`, status: "ACTIVE" } })
    ).id;
    courseId = (
      await prisma.course.create({
        data: { title: "ST", slug: `st-${suffix}`, status: "PUBLISHED", publishedAt: new Date() },
      })
    ).id;
    const subject = await prisma.subject.create({
      data: { courseId, title: "S", slug: "s", status: "PUBLISHED" },
    });
    await prisma.enrollment.create({
      data: { userId, courseId, status: "ACTIVE", source: "ADMIN_GRANT" },
    });
    const a = await prisma.question.create({
      data: {
        subjectId: subject.id,
        type: "SINGLE_CHOICE",
        text: "Part A question",
        status: "PUBLISHED",
        options: {
          create: [
            { text: "x", isCorrect: true, position: 0 },
            { text: "y", isCorrect: false, position: 1 },
          ],
        },
      },
      include: { options: true },
    });
    qA = a.id;
    optA = a.options[0]!.id;
    qB = (
      await prisma.question.create({
        data: {
          subjectId: subject.id,
          type: "NUMERIC",
          text: "Part B question",
          status: "PUBLISHED",
          numericMin: 1,
          numericMax: 1,
        },
      })
    ).id;
    const quiz = await prisma.quiz.create({
      data: {
        subjectId: subject.id,
        title: "Sectioned",
        slug: `sectioned-${suffix}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
        sections: {
          create: [
            { title: "Part A", position: 0, timeLimitMinutes: 120 },
            { title: "Part B", position: 1, timeLimitMinutes: 60 },
          ],
        },
      },
      include: { sections: { orderBy: { position: "asc" } } },
    });
    quizId = quiz.id;
    await prisma.quizQuestion.createMany({
      data: [
        { quizId, questionId: qA, sectionId: quiz.sections[0]!.id, position: 0 },
        { quizId, questionId: qB, sectionId: quiz.sections[1]!.id, position: 1 },
      ],
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.question.deleteMany({ where: { id: { in: [qA, qB] } } });
    await prisma.quiz.deleteMany({ where: { id: quizId } });
    await moduleRef.close();
  });

  it("runs sections in order: B hidden and locked, A closes after moving on", async () => {
    const { attempt } = await attempts.start(quizId, userId);
    expect(attempt.expiresAt!.getTime() - attempt.startedAt.getTime()).toBe(180 * 60_000);

    const state = toAttemptState(await attempts.getAttemptState(attempt.id, userId));
    expect(state.timing?.sections.map((s) => s.status)).toEqual(["CURRENT", "UPCOMING"]);
    expect(state.questions.find((q) => q.questionId === qB)?.text).toBe("");

    await expect(attempts.autosaveAnswer(attempt.id, userId, qB, [], 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await attempts.autosaveAnswer(attempt.id, userId, qA, [optA]);

    const moved = await attempts.nextSection(attempt.id, userId);
    expect(moved.currentSection).toBe(1);
    // Part B gets its full 60 minutes from now.
    expect(moved.expiresAt!.getTime() - moved.sectionStartedAt!.getTime()).toBe(60 * 60_000);
    await expect(attempts.autosaveAnswer(attempt.id, userId, qA, [])).rejects.toBeInstanceOf(
      ConflictException,
    );
    await attempts.autosaveAnswer(attempt.id, userId, qB, [], 1);
    await expect(attempts.nextSection(attempt.id, userId)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const { attempt: done } = await attempts.submit(attempt.id, userId);
    expect(Number(done.obtainedMarks)).toBe(2);
  });

  it("moves to Part B by itself when Part A's time runs out, then auto-submits", async () => {
    const { attempt } = await attempts.start(quizId, userId);
    // Pretend Part A started 2h10m ago: it ended 10 minutes ago, so Part B started then.
    const past = new Date(Date.now() - 130 * 60_000);
    await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        startedAt: past,
        sectionStartedAt: past,
        expiresAt: new Date(past.getTime() + 180 * 60_000),
      },
    });
    const state = toAttemptState(await attempts.getAttemptState(attempt.id, userId));
    expect(state.timing?.sections.map((s) => s.status)).toEqual(["DONE", "CURRENT"]);
    expect(state.timing!.sectionRemainingSeconds).toBeGreaterThan(49 * 60);
    expect(state.timing!.sectionRemainingSeconds).toBeLessThanOrEqual(50 * 60);

    // Part B's time also gone: the attempt is submitted automatically.
    const longAgo = new Date(Date.now() - 200 * 60_000);
    await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        currentSection: 0,
        startedAt: longAgo,
        sectionStartedAt: longAgo,
        expiresAt: new Date(longAgo.getTime() + 180 * 60_000),
      },
    });
    const after = toAttemptState(await attempts.getAttemptState(attempt.id, userId));
    expect(after.status).toBe("AUTO_SUBMITTED");
  });
});
