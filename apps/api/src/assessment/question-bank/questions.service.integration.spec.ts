import { BadRequestException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { QuestionsService } from "./questions.service";

describe("QuestionsService (integration)", () => {
  let questions: QuestionsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  const actorId = "00000000-0000-4000-8000-000000000001";
  const createdQuestionIds: string[] = [];
  const createdQuizIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [QuestionsService, PrismaService],
    }).compile();
    questions = moduleRef.get(QuestionsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.quiz.deleteMany({ where: { id: { in: createdQuizIds } } });
    await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } });
    await moduleRef.close();
  });

  it("creates a question with options", async () => {
    const question = await questions.create(
      {
        type: "SINGLE_CHOICE",
        text: "2 + 2 = ?",
        options: [
          { text: "4", isCorrect: true },
          { text: "5", isCorrect: false },
        ],
      },
      actorId,
    );
    createdQuestionIds.push(question.id);
    expect(question.status).toBe("DRAFT");
    expect(question.options).toHaveLength(2);
  });

  it("rejects a question with zero correct options", async () => {
    await expect(
      questions.create(
        {
          type: "SINGLE_CHOICE",
          text: "No answer",
          options: [
            { text: "A", isCorrect: false },
            { text: "B", isCorrect: false },
          ],
        },
        actorId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects SINGLE_CHOICE with more than one correct option", async () => {
    await expect(
      questions.create(
        {
          type: "SINGLE_CHOICE",
          text: "Two correct",
          options: [
            { text: "A", isCorrect: true },
            { text: "B", isCorrect: true },
          ],
        },
        actorId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects TRUE_FALSE with anything other than exactly 2 options", async () => {
    await expect(
      questions.create(
        {
          type: "TRUE_FALSE",
          text: "The sky is blue",
          options: [
            { text: "True", isCorrect: true },
            { text: "False", isCorrect: false },
            { text: "Maybe", isCorrect: false },
          ],
        },
        actorId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepts MULTIPLE_CHOICE with more than one correct option", async () => {
    const question = await questions.create(
      {
        type: "MULTIPLE_CHOICE",
        text: "Pick primary colors",
        options: [
          { text: "Red", isCorrect: true },
          { text: "Green", isCorrect: false },
          { text: "Blue", isCorrect: true },
        ],
      },
      actorId,
    );
    createdQuestionIds.push(question.id);
    expect(question.options.filter((o) => o.isCorrect)).toHaveLength(2);
  });

  it("preserves option ids across an edit that keeps the same option count", async () => {
    const question = await questions.create(
      {
        type: "SINGLE_CHOICE",
        text: "Original",
        options: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: false },
        ],
      },
      actorId,
    );
    createdQuestionIds.push(question.id);
    const originalOptionIds = question.options.map((o) => o.id);

    const updated = await questions.update(question.id, {
      text: "Edited",
      options: [
        { text: "A-edited", isCorrect: true },
        { text: "B-edited", isCorrect: false },
      ],
    });

    expect(updated.options.map((o) => o.id).sort()).toEqual([...originalOptionIds].sort());
  });

  it("blocks status change away from PUBLISHED while assigned to a PUBLISHED quiz", async () => {
    const question = await questions.create(
      {
        type: "SINGLE_CHOICE",
        text: "Live question",
        options: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: false },
        ],
      },
      actorId,
    );
    createdQuestionIds.push(question.id);
    await questions.changeStatus(question.id, "PUBLISHED");

    const quiz = await prisma.quiz.create({
      data: {
        title: "Guard Quiz",
        slug: `guard-quiz-${Date.now()}`,
        status: "PUBLISHED",
        quizQuestions: { create: [{ questionId: question.id, marks: 1, position: 0 }] },
      },
    });
    createdQuizIds.push(quiz.id);

    await expect(questions.changeStatus(question.id, "ARCHIVED")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("blocks deletion while assigned to any quiz", async () => {
    const question = await questions.create(
      {
        type: "SINGLE_CHOICE",
        text: "Assigned question",
        options: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: false },
        ],
      },
      actorId,
    );
    createdQuestionIds.push(question.id);
    await questions.changeStatus(question.id, "PUBLISHED");

    const quiz = await prisma.quiz.create({
      data: {
        title: "Delete Guard Quiz",
        slug: `delete-guard-quiz-${Date.now()}`,
        status: "DRAFT",
        quizQuestions: { create: [{ questionId: question.id, marks: 1, position: 0 }] },
      },
    });
    createdQuizIds.push(quiz.id);

    await expect(questions.remove(question.id)).rejects.toBeInstanceOf(BadRequestException);
  });
});
