import { BadRequestException, ConflictException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { QuestionsService } from "../question-bank/questions.service";
import { QuizzesService } from "./quizzes.service";

describe("QuizzesService (integration)", () => {
  let quizzes: QuizzesService;
  let questionsService: QuestionsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  const actorId = "00000000-0000-4000-8000-000000000002";
  const createdQuizIds: string[] = [];
  const createdQuestionIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [QuizzesService, QuestionsService, PrismaService],
    }).compile();
    quizzes = moduleRef.get(QuizzesService);
    questionsService = moduleRef.get(QuestionsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.quiz.deleteMany({ where: { id: { in: createdQuizIds } } });
    await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
    await moduleRef.close();
  });

  function unique(label: string): string {
    return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function publishedQuestion() {
    const q = await questionsService.create(
      {
        type: "SINGLE_CHOICE",
        text: unique("Q"),
        options: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: false },
        ],
      },
      actorId,
    );
    createdQuestionIds.push(q.id);
    return questionsService.changeStatus(q.id, "PUBLISHED");
  }

  it("creates a quiz in DRAFT with an auto-derived slug", async () => {
    const quiz = await quizzes.create({ title: unique("Mock Test") }, actorId);
    createdQuizIds.push(quiz.id);
    expect(quiz.status).toBe("DRAFT");
    expect(quiz.slug).toMatch(/^mock-test-/);
  });

  it("rejects a duplicate slug", async () => {
    const slug = unique("dup-quiz");
    const first = await quizzes.create({ title: "First", slug }, actorId);
    createdQuizIds.push(first.id);
    await expect(quizzes.create({ title: "Second", slug }, actorId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("refuses to publish a quiz with no assigned questions", async () => {
    const quiz = await quizzes.create({ title: unique("Empty") }, actorId);
    createdQuizIds.push(quiz.id);
    await expect(quizzes.changeStatus(quiz.id, "PUBLISHED")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("refuses to publish a quiz that has an unpublished (DRAFT) assigned question", async () => {
    const quiz = await quizzes.create({ title: unique("Has Draft Question") }, actorId);
    createdQuizIds.push(quiz.id);
    const draftQuestion = await questionsService.create(
      {
        type: "SINGLE_CHOICE",
        text: unique("Draft Q"),
        options: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: false },
        ],
      },
      actorId,
    );
    createdQuestionIds.push(draftQuestion.id);
    await prisma.quizQuestion.create({
      data: { quizId: quiz.id, questionId: draftQuestion.id, marks: 1, position: 0 },
    });

    await expect(quizzes.changeStatus(quiz.id, "PUBLISHED")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("publishes once every assigned question is PUBLISHED", async () => {
    const quiz = await quizzes.create({ title: unique("Ready") }, actorId);
    createdQuizIds.push(quiz.id);
    const question = await publishedQuestion();
    await prisma.quizQuestion.create({
      data: { quizId: quiz.id, questionId: question.id, marks: 1, position: 0 },
    });

    const published = await quizzes.changeStatus(quiz.id, "PUBLISHED");
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).not.toBeNull();
  });

  it("refuses to delete a PUBLISHED quiz until archived", async () => {
    const quiz = await quizzes.create({ title: unique("Delete Guard") }, actorId);
    createdQuizIds.push(quiz.id);
    const question = await publishedQuestion();
    await prisma.quizQuestion.create({
      data: { quizId: quiz.id, questionId: question.id, marks: 1, position: 0 },
    });
    await quizzes.changeStatus(quiz.id, "PUBLISHED");

    await expect(quizzes.remove(quiz.id)).rejects.toBeInstanceOf(BadRequestException);
    await quizzes.changeStatus(quiz.id, "ARCHIVED");
    await quizzes.remove(quiz.id);
  });
});
