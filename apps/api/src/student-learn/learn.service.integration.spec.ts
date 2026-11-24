import { ConflictException, ForbiddenException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { QuizCatalogService } from "../assessment/quiz-catalog/quiz-catalog.service";
import { QuizAttemptsService } from "../assessment/quiz-attempts/quiz-attempts.service";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { XpService } from "../gamification/xp.service";
import { CatalogService } from "../learning/catalog.service";
import { ProgressService } from "../learning/progress.service";
import { PrismaService } from "../prisma/prisma.service";
import { fakeNotificationsServiceProvider } from "../../test/support/fake-notifications-service";
import { LearnService } from "./learn.service";
import { LessonQuestionsService } from "./lesson-questions.service";

/**
 * Student Learn section (student module redesign): licence gate, topic
 * progress (lessons completed + quizzes attempted), quiz attempt limit and
 * XP for lessons and quizzes, and admin bulk licences.
 */
describe("LearnService + XP + licences (integration)", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let learn: LearnService;
  let progress: ProgressService;
  let attempts: QuizAttemptsService;
  let xp: XpService;
  let enrollment: EnrollmentService;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let studentId: string;
  let courseId: string;
  let subjectId: string;
  let topicId: string;
  let lessonIds: string[];
  let quizId: string;
  let correctOptionId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        LearnService,
        LessonQuestionsService,
        ProgressService,
        CatalogService,
        QuizAttemptsService,
        QuizCatalogService,
        EnrollmentService,
        XpService,
        PrismaService,
        fakeNotificationsServiceProvider(),
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    learn = moduleRef.get(LearnService);
    progress = moduleRef.get(ProgressService);
    attempts = moduleRef.get(QuizAttemptsService);
    xp = moduleRef.get(XpService);
    enrollment = moduleRef.get(EnrollmentService);
    await prisma.$connect();

    const studentRole = await prisma.role.findUniqueOrThrow({ where: { name: "STUDENT" } });
    const student = await prisma.user.create({
      data: {
        email: `learn-int-${suffix}@example.test`,
        status: "ACTIVE",
        roles: { create: { roleId: studentRole.id } },
      },
    });
    studentId = student.id;

    const P = { status: "PUBLISHED" as const };
    const course = await prisma.course.create({
      data: {
        title: "Learn int course",
        slug: `learn-int-${suffix}`,
        ...P,
        publishedAt: new Date(),
      },
    });
    courseId = course.id;
    const subject = await prisma.subject.create({
      data: { courseId, title: "Reasoning", slug: "reasoning", kind: "SUBJECT", ...P },
    });
    subjectId = subject.id;
    const topic = await prisma.topic.create({
      data: { subjectId, title: "Puzzles", slug: "puzzles", ...P },
    });
    topicId = topic.id;
    const mod = await prisma.module.create({
      data: { topicId, title: "Lessons", slug: "lessons", ...P },
    });
    lessonIds = [];
    for (let i = 0; i < 3; i++) {
      const l = await prisma.lesson.create({
        data: {
          moduleId: mod.id,
          title: `Lesson ${i + 1}`,
          slug: `lesson-${i + 1}`,
          body: "x",
          position: i,
          xpReward: 10,
          ...P,
        },
      });
      lessonIds.push(l.id);
    }
    const question = await prisma.question.create({
      data: {
        subjectId,
        type: "SINGLE_CHOICE",
        text: "2 + 2?",
        ...P,
        options: {
          create: [
            { text: "4", isCorrect: true, position: 0 },
            { text: "5", isCorrect: false, position: 1 },
          ],
        },
      },
      include: { options: true },
    });
    correctOptionId = question.options.find((o) => o.isCorrect)!.id;
    const quiz = await prisma.quiz.create({
      data: {
        subjectId,
        topicId,
        title: "Topic quiz",
        slug: `learn-int-quiz-${suffix}`,
        maxAttempts: 2,
        xpReward: 20,
        level: "EASY",
        ...P,
        publishedAt: new Date(),
        quizQuestions: { create: { questionId: question.id, marks: 1 } },
      },
    });
    quizId = quiz.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: studentId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.question.deleteMany({ where: { subjectId } });
    await moduleRef.close();
  });

  it("refuses every Learn endpoint without a licence, even for a free course", async () => {
    await expect(learn.getCourseOverview(studentId, courseId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(learn.getTopic(studentId, topicId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(await learn.listMyCourses(studentId)).toEqual([]);
  });

  it("bulk-grants a licence to selected students, then opens the course", async () => {
    const result = await enrollment.adminBulkGrant({ courseIds: [courseId], userIds: [studentId] });
    expect(result).toEqual({ students: 1, courses: 1, changed: 1 });
    // Granting again changes nothing.
    expect(
      (await enrollment.adminBulkGrant({ courseIds: [courseId], userIds: [studentId] })).changed,
    ).toBe(0);
    expect((await learn.listMyCourses(studentId)).map((c) => c.id)).toEqual([courseId]);
  });

  it("counts topic progress as lessons completed plus quizzes attempted", async () => {
    await progress.complete(studentId, lessonIds[0]!);
    const subject = await learn.getSubject(studentId, subjectId);
    // 1 of 4 items (3 lessons + 1 quiz).
    expect(subject.topics[0]!.percent).toBe(25);

    const topic = await learn.getTopic(studentId, topicId);
    expect(topic.lessons.map((l) => l.completed)).toEqual([true, false, false]);
    expect(topic.suggestions[0]).toMatchObject({ kind: "lesson", id: lessonIds[1] });
  });

  it("pays lesson XP once, however often the lesson is completed", async () => {
    const before = await xp.getTotal(studentId);
    const first = await progress.complete(studentId, lessonIds[1]!);
    const again = await progress.complete(studentId, lessonIds[1]!);
    expect(first.xpAwarded).toBe(10);
    expect(again.xpAwarded).toBe(0);
    expect(await xp.getTotal(studentId)).toBe(before + 10);
  });

  it("awards quiz XP doubled on a perfect topic-quiz score, then enforces the attempt limit", async () => {
    const before = await xp.getTotal(studentId);
    const first = await attempts.start(quizId, studentId);
    const qid = (first.attempt.questionSnapshot as unknown as { questionId: string }[])[0]!
      .questionId;
    await attempts.autosaveAnswer(first.attempt.id, studentId, qid, [correctOptionId]);
    await attempts.submit(first.attempt.id, studentId);
    expect(await xp.getTotal(studentId)).toBe(before + 40);

    // Second attempt: allowed (limit 2), pays nothing more.
    const second = await attempts.start(quizId, studentId);
    await attempts.submit(second.attempt.id, studentId);
    expect(await xp.getTotal(studentId)).toBe(before + 40);

    await expect(attempts.start(quizId, studentId)).rejects.toBeInstanceOf(ConflictException);

    const info = await learn.getQuizInfo(studentId, quizId);
    expect(info).toMatchObject({ attemptsUsed: 2, inProgressAttemptId: null });
    expect(info.quiz).toMatchObject({ maxAttempts: 2, doublesOnPerfect: true, questionCount: 1 });
  });

  it("bulk-revoke closes the course again", async () => {
    const result = await enrollment.adminBulkRevoke({
      courseIds: [courseId],
      userIds: [studentId],
    });
    expect(result.changed).toBe(1);
    await expect(learn.getSubject(studentId, subjectId)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
