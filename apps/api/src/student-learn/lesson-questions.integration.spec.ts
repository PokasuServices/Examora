import { BadRequestException, ConflictException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { isLessonAnswerCorrect, LessonQuestionsService } from "./lesson-questions.service";

describe("isLessonAnswerCorrect", () => {
  const options = [
    { id: "a", text: "", imageUrl: null, isCorrect: true },
    { id: "b", text: "", imageUrl: null, isCorrect: false },
    { id: "c", text: "", imageUrl: null, isCorrect: true },
  ];
  const choice = { type: "MULTIPLE_CHOICE" as const, numericMin: null, numericMax: null, options };

  it("needs the exact set of correct options", () => {
    expect(isLessonAnswerCorrect(choice, ["a", "c"], null)).toBe(true);
    expect(isLessonAnswerCorrect(choice, ["a"], null)).toBe(false);
    expect(isLessonAnswerCorrect(choice, ["a", "b", "c"], null)).toBe(false);
  });
});

/** Practice questions inside a lesson: attach, hidden answers, answer once, reveal. */
describe("LessonQuestionsService (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let service: LessonQuestionsService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let userId: string;
  let courseId: string;
  let lessonId: string;
  let choiceId: string;
  let numericId: string;
  let uploadId: string;
  let rightOption: string;
  let wrongOption: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [LessonQuestionsService, PrismaService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(LessonQuestionsService);
    await prisma.$connect();

    userId = (
      await prisma.user.create({ data: { email: `lq-${suffix}@example.test`, status: "ACTIVE" } })
    ).id;
    const course = await prisma.course.create({
      data: { title: "LQ", slug: `lq-${suffix}`, status: "PUBLISHED" },
    });
    courseId = course.id;
    const subject = await prisma.subject.create({
      data: { courseId, title: "S", slug: "s", status: "PUBLISHED" },
    });
    const topic = await prisma.topic.create({
      data: { subjectId: subject.id, title: "T", slug: "t", status: "PUBLISHED" },
    });
    const mod = await prisma.module.create({
      data: { topicId: topic.id, title: "M", slug: "m", status: "PUBLISHED" },
    });
    lessonId = (
      await prisma.lesson.create({
        data: { moduleId: mod.id, title: "Examples", slug: "examples", status: "PUBLISHED" },
      })
    ).id;
    const choice = await prisma.question.create({
      data: {
        subjectId: subject.id,
        type: "SINGLE_CHOICE",
        text: "Pick a",
        explanation: "Because a.",
        options: {
          create: [
            { text: "a", isCorrect: true, position: 0 },
            { text: "b", isCorrect: false, position: 1 },
          ],
        },
      },
      include: { options: { orderBy: { position: "asc" } } },
    });
    choiceId = choice.id;
    rightOption = choice.options[0]!.id;
    wrongOption = choice.options[1]!.id;
    numericId = (
      await prisma.question.create({
        data: { type: "NUMERIC", text: "Length?", numericMin: 132.8, numericMax: 133.1 },
      })
    ).id;
    uploadId = (
      await prisma.question.create({ data: { type: "UPLOAD", text: "Draw", criteria: ["x"] } })
    ).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.question.deleteMany({ where: { id: { in: [choiceId, numericId, uploadId] } } });
    await moduleRef.close();
  });

  it("attaches bank questions, refusing duplicates and sketch questions", async () => {
    await service.adminAttach(lessonId, choiceId);
    const list = await service.adminAttach(lessonId, numericId);
    expect(list.map((l) => l.questionId)).toEqual([choiceId, numericId]);
    await expect(service.adminAttach(lessonId, choiceId)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.adminAttach(lessonId, uploadId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("hides answers until the student answers, then reveals them; one try only", async () => {
    const before = await service.forStudent(userId, lessonId);
    expect(before).toHaveLength(2);
    expect(before[0]!.answer).toBeNull();
    expect(JSON.stringify(before)).not.toContain("isCorrect");
    expect(JSON.stringify(before)).not.toContain("Because a.");

    const wrong = await service.answer(userId, lessonId, before[0]!.id, {
      optionIds: [wrongOption],
      method: "GUESS",
    });
    expect(wrong.answer).toMatchObject({
      correct: false,
      method: "GUESS",
      correctOptionIds: [rightOption],
      explanation: "Because a.",
    });
    await expect(
      service.answer(userId, lessonId, before[0]!.id, { optionIds: [rightOption] }),
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      service.answer(userId, lessonId, before[1]!.id, { optionIds: [rightOption] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const numeric = await service.answer(userId, lessonId, before[1]!.id, { numericValue: 133 });
    expect(numeric.answer).toMatchObject({
      correct: true,
      numericRange: { min: 132.8, max: 133.1 },
    });

    const after = await service.forStudent(userId, lessonId);
    expect(after.map((q) => q.answer?.correct)).toEqual([false, true]);
  });
});
