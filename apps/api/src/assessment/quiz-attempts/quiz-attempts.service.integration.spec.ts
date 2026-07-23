import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { PrismaService } from "../../prisma/prisma.service";
import { seedPublishedQuiz } from "../../../test/support/assessment-seed";
import { QuizCatalogService } from "../quiz-catalog/quiz-catalog.service";
import { QuizAttemptsService } from "./quiz-attempts.service";

describe("QuizAttemptsService (integration)", () => {
  let attempts: QuizAttemptsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [QuizAttemptsService, QuizCatalogService, EnrollmentService, PrismaService],
    }).compile();
    attempts = moduleRef.get(QuizAttemptsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const learner = await prisma.user.create({
      data: { email: `quiz-attempt-int-${Date.now()}@example.test`, status: "ACTIVE" },
    });
    userId = learner.id;
    const other = await prisma.user.create({
      data: { email: `quiz-attempt-int-other-${Date.now()}@example.test`, status: "ACTIVE" },
    });
    otherUserId = other.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await moduleRef.close();
  });

  it("starts an attempt with a frozen question snapshot covering every assigned question", async () => {
    const seeded = await seedPublishedQuiz(prisma, { questionCount: 3, marksPerQuestion: 5 });
    const { attempt, created } = await attempts.start(seeded.quizId, userId);
    expect(created).toBe(true);
    expect(attempt.status).toBe("IN_PROGRESS");
    expect(Number(attempt.totalMarks)).toBe(15);

    const snapshot = attempt.questionSnapshot as unknown as { questionId: string }[];
    expect(snapshot.map((s) => s.questionId).sort()).toEqual([...seeded.questionIds].sort());

    await seeded.cleanup();
  });

  it("resuming (calling start again) returns the SAME in-progress attempt, not a new one", async () => {
    const seeded = await seedPublishedQuiz(prisma, { questionCount: 2 });
    const first = await attempts.start(seeded.quizId, userId);
    const second = await attempts.start(seeded.quizId, userId);
    expect(second.created).toBe(false);
    expect(second.attempt.id).toBe(first.attempt.id);
    await seeded.cleanup();
  });

  it("rejects starting an attempt on a quiz with no assigned questions", async () => {
    const seeded = await seedPublishedQuiz(prisma, { questionCount: 0 });
    await expect(attempts.start(seeded.quizId, userId)).rejects.toBeInstanceOf(BadRequestException);
    await seeded.cleanup();
  });

  it("404s when a different user tries to access someone else's attempt", async () => {
    const seeded = await seedPublishedQuiz(prisma, { questionCount: 1 });
    const { attempt } = await attempts.start(seeded.quizId, userId);
    await expect(attempts.getAttemptState(attempt.id, otherUserId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await seeded.cleanup();
  });

  it("autosave upserts an answer and rejects an option id not offered for the question", async () => {
    const seeded = await seedPublishedQuiz(prisma, { questionCount: 1 });
    const { attempt } = await attempts.start(seeded.quizId, userId);
    const questionId = seeded.questionIds[0]!;
    const correctOptionId = seeded.correctOptionIdByQuestion.get(questionId)![0]!;

    await attempts.autosaveAnswer(attempt.id, userId, questionId, [correctOptionId]);
    const state = await attempts.getAttemptState(attempt.id, userId);
    expect(state.answerByQuestion.get(questionId)?.selectedOptionIds).toEqual([correctOptionId]);

    await expect(
      attempts.autosaveAnswer(attempt.id, userId, questionId, [
        "00000000-0000-4000-8000-000000000099",
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);

    await seeded.cleanup();
  });

  it("scores correctly: correct answers earn marks, wrong/unanswered earn none without negative marking", async () => {
    const seeded = await seedPublishedQuiz(prisma, { questionCount: 3, marksPerQuestion: 4 });
    const { attempt } = await attempts.start(seeded.quizId, userId);
    const [q1, q2] = seeded.questionIds;

    await attempts.autosaveAnswer(
      attempt.id,
      userId,
      q1!,
      seeded.correctOptionIdByQuestion.get(q1!)!,
    );
    const wrongOption = seeded.optionIdsByQuestion
      .get(q2!)!
      .find((id) => !seeded.correctOptionIdByQuestion.get(q2!)!.includes(id))!;
    await attempts.autosaveAnswer(attempt.id, userId, q2!, [wrongOption]);
    // q3 left unanswered

    const { attempt: submitted, justSubmitted } = await attempts.submit(attempt.id, userId);
    expect(justSubmitted).toBe(true);
    expect(submitted.status).toBe("SUBMITTED");
    expect(Number(submitted.obtainedMarks)).toBe(4);
    expect(submitted.correctCount).toBe(1);
    expect(submitted.wrongCount).toBe(1);
    expect(submitted.unansweredCount).toBe(1);
    expect(Number(submitted.percentage)).toBeCloseTo((4 / 12) * 100, 1);

    await seeded.cleanup();
  });

  it("applies negative marking to wrong-but-attempted answers only", async () => {
    const seeded = await seedPublishedQuiz(prisma, {
      questionCount: 2,
      marksPerQuestion: 4,
      negativeMarkingEnabled: true,
      negativeMarksPerWrong: 0.25,
    });
    const { attempt } = await attempts.start(seeded.quizId, userId);
    const [q1] = seeded.questionIds;
    const wrongOption = seeded.optionIdsByQuestion
      .get(q1!)!
      .find((id) => !seeded.correctOptionIdByQuestion.get(q1!)!.includes(id))!;
    await attempts.autosaveAnswer(attempt.id, userId, q1!, [wrongOption]);
    // second question left unanswered — must not be penalized

    const { attempt: submitted } = await attempts.submit(attempt.id, userId);
    expect(Number(submitted.obtainedMarks)).toBe(-1); // 4 * 0.25
    await seeded.cleanup();
  });

  it("is idempotent — submitting an already-submitted attempt returns the same stored result", async () => {
    const seeded = await seedPublishedQuiz(prisma, { questionCount: 1 });
    const { attempt } = await attempts.start(seeded.quizId, userId);
    const first = await attempts.submit(attempt.id, userId);
    expect(first.justSubmitted).toBe(true);

    const second = await attempts.submit(attempt.id, userId);
    expect(second.justSubmitted).toBe(false);
    expect(second.attempt.obtainedMarks?.toString()).toBe(first.attempt.obtainedMarks?.toString());
    expect(second.attempt.version).toBe(first.attempt.version);

    await seeded.cleanup();
  });

  it("rejects autosave once an attempt is finalized", async () => {
    const seeded = await seedPublishedQuiz(prisma, { questionCount: 1 });
    const { attempt } = await attempts.start(seeded.quizId, userId);
    await attempts.submit(attempt.id, userId);
    await expect(
      attempts.autosaveAnswer(attempt.id, userId, seeded.questionIds[0]!, []),
    ).rejects.toBeInstanceOf(ConflictException);
    await seeded.cleanup();
  });

  it("under concurrent submit calls, scores exactly once (no double-scoring, all callers see the same result)", async () => {
    const seeded = await seedPublishedQuiz(prisma, { questionCount: 2, marksPerQuestion: 5 });
    const { attempt } = await attempts.start(seeded.quizId, userId);
    await attempts.autosaveAnswer(
      attempt.id,
      userId,
      seeded.questionIds[0]!,
      seeded.correctOptionIdByQuestion.get(seeded.questionIds[0]!)!,
    );

    const results = await Promise.all(
      Array.from({ length: 8 }, () => attempts.submit(attempt.id, userId)),
    );

    const winners = results.filter((r) => r.justSubmitted);
    expect(winners).toHaveLength(1);
    const obtained = new Set(results.map((r) => r.attempt.obtainedMarks?.toString()));
    expect(obtained.size).toBe(1); // every caller agrees on the final score
    expect([...obtained][0]).toBe("5");

    const finalAttempt = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(finalAttempt.version).toBe(2); // exactly one version increment, not eight

    await seeded.cleanup();
  });

  it("auto-submits an attempt whose time has run out on next access, without a manual submit", async () => {
    const seeded = await seedPublishedQuiz(prisma, { questionCount: 1, timeLimitMinutes: 30 });
    const { attempt } = await attempts.start(seeded.quizId, userId);
    // Simulate time having run out already.
    const pastExpiry = new Date(Date.now() - 60_000);
    await prisma.quizAttempt.update({ where: { id: attempt.id }, data: { expiresAt: pastExpiry } });

    const state = await attempts.getAttemptState(attempt.id, userId);
    expect(state.attempt.status).toBe("AUTO_SUBMITTED");
    expect(state.attempt.submittedAt?.getTime()).toBe(pastExpiry.getTime());

    await seeded.cleanup();
  });

  it("resumes with a stable question order across repeated reads (shuffle frozen at start)", async () => {
    const seeded = await seedPublishedQuiz(prisma, { questionCount: 5, shuffleQuestions: true });
    const { attempt } = await attempts.start(seeded.quizId, userId);
    const first = await attempts.getAttemptState(attempt.id, userId);
    const second = await attempts.getAttemptState(attempt.id, userId);
    expect(first.snapshot.map((s) => s.questionId)).toEqual(
      second.snapshot.map((s) => s.questionId),
    );
    await seeded.cleanup();
  });
});
