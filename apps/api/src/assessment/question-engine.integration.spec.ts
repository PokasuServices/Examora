import { BadRequestException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { toAttemptReview } from "./assessment.mappers";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { PrismaService } from "../prisma/prisma.service";
import { fakeNotificationsServiceProvider } from "../../test/support/fake-notifications-service";
import { QuestionsService } from "./question-bank/questions.service";
import { QuizCatalogService } from "./quiz-catalog/quiz-catalog.service";
import { QuizAttemptsService } from "./quiz-attempts/quiz-attempts.service";

const IMAGE_REF = "media:3f2a3a52-7a1b-4c47-9a35-0d6f0d1b2c3d";

/**
 * Question engine (student module redesign): numeric answers, image options,
 * partial marks for multi-select, per-question negative marks, and the review
 * outcome that the report screens rely on.
 */
describe("Question engine (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let questions: QuestionsService;
  let attempts: QuizAttemptsService;
  let userId: string;
  const createdQuestionIds: string[] = [];
  let quizId: string | null = null;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        QuestionsService,
        QuizAttemptsService,
        QuizCatalogService,
        EnrollmentService,
        PrismaService,
        fakeNotificationsServiceProvider(),
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    questions = moduleRef.get(QuestionsService);
    attempts = moduleRef.get(QuizAttemptsService);
    await prisma.$connect();
    const user = await prisma.user.create({
      data: { email: `question-engine-${Date.now()}@example.test`, status: "ACTIVE" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (quizId) await prisma.quiz.deleteMany({ where: { id: quizId } });
    await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await moduleRef.close();
  });

  async function create(dto: Parameters<QuestionsService["create"]>[0]) {
    const q = await questions.create(dto, userId);
    createdQuestionIds.push(q.id);
    return q;
  }

  it("validates NUMERIC questions: range required, no options, min ≤ max", async () => {
    await expect(
      questions.create({ type: "NUMERIC", text: "No range", options: [] }, userId),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      questions.create(
        { type: "NUMERIC", text: "Backwards", options: [], numericMin: 5, numericMax: 4 },
        userId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      questions.create(
        {
          type: "NUMERIC",
          text: "Has options",
          numericMin: 1,
          numericMax: 1,
          options: [
            { text: "a", isCorrect: true },
            { text: "b", isCorrect: false },
          ],
        },
        userId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const q = await create({
      type: "NUMERIC",
      text: "Area?",
      options: [],
      numericMin: 154,
      numericMax: 154.5,
      imageUrl: IMAGE_REF,
    });
    expect(q.options).toHaveLength(0);
    expect(Number(q.numericMin)).toBe(154);
    expect(q.imageUrl).toBe(IMAGE_REF);
  });

  it("accepts image-only options and rejects options with neither text nor image", async () => {
    const q = await create({
      type: "SINGLE_CHOICE",
      text: "Which is a rotation of P?",
      options: [
        { text: "", imageUrl: IMAGE_REF, isCorrect: true },
        { text: "B", isCorrect: false },
      ],
    });
    expect(q.options[0]!.imageUrl).toBe(IMAGE_REF);

    await expect(
      questions.create(
        {
          type: "SINGLE_CHOICE",
          text: "Empty option",
          options: [
            { text: "", isCorrect: true },
            { text: "B", isCorrect: false },
          ],
        },
        userId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects media references that are neither https URLs nor uploaded media", async () => {
    await expect(
      questions.create(
        {
          type: "SINGLE_CHOICE",
          text: "Bad image",
          imageUrl: "javascript:alert(1)",
          options: [
            { text: "A", isCorrect: true },
            { text: "B", isCorrect: false },
          ],
        },
        userId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("scores numeric, partial multi-select and per-question penalties end to end", async () => {
    const numeric = await create({
      type: "NUMERIC",
      text: "2 × 7 = ?",
      options: [],
      numericMin: 14,
      numericMax: 14,
    });
    const multi = await create({
      type: "MULTIPLE_CHOICE",
      text: "Pick the rotations",
      partialMarking: true,
      options: [
        { text: "A", isCorrect: true },
        { text: "B", isCorrect: true },
        { text: "C", isCorrect: false },
      ],
    });
    const single = await create({
      type: "SINGLE_CHOICE",
      text: "Stackable chair?",
      options: [
        { text: "Yes", isCorrect: true },
        { text: "No", isCorrect: false },
      ],
    });
    await prisma.question.updateMany({
      where: { id: { in: [numeric.id, multi.id, single.id] } },
      data: { status: "PUBLISHED" },
    });
    const quiz = await prisma.quiz.create({
      data: {
        title: "Engine quiz",
        slug: `engine-quiz-${Date.now()}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
        quizQuestions: {
          create: [
            { questionId: numeric.id, marks: 1, position: 0 },
            { questionId: multi.id, marks: 2, position: 1 },
            { questionId: single.id, marks: 1, negativeMarks: 0.71, position: 2 },
          ],
        },
      },
    });
    quizId = quiz.id;

    const { attempt } = await attempts.start(quiz.id, userId);
    await attempts.autosaveAnswer(attempt.id, userId, numeric.id, [], 14);
    const firstMulti = multi.options.find((o) => o.text === "A")!.id;
    await attempts.autosaveAnswer(attempt.id, userId, multi.id, [firstMulti]);
    const wrongSingle = single.options.find((o) => !o.isCorrect)!.id;
    await attempts.autosaveAnswer(attempt.id, userId, single.id, [wrongSingle]);

    const state = await attempts.getAttemptState(attempt.id, userId);
    expect(Number(state.answerByQuestion.get(numeric.id)?.numericAnswer)).toBe(14);

    const { attempt: done } = await attempts.submit(attempt.id, userId);
    // 1 (numeric) + 1 (half of 2) − 0.71 (penalty) = 1.29
    expect(Number(done.obtainedMarks)).toBe(1.29);
    expect(done.correctCount).toBe(2);
    expect(done.wrongCount).toBe(1);

    const review = toAttemptReview(await attempts.getReview(attempt.id, userId));
    const byId = new Map(review.questions.map((q) => [q.questionId, q]));
    expect(byId.get(numeric.id)).toMatchObject({
      outcome: "CORRECT",
      numericAnswer: 14,
      numericRange: { min: 14, max: 14 },
    });
    expect(byId.get(multi.id)).toMatchObject({ outcome: "PARTIAL", marksAwarded: 1 });
    expect(byId.get(single.id)).toMatchObject({ outcome: "WRONG", marksAwarded: -0.71 });
  });
});
