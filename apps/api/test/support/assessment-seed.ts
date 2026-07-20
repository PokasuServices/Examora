import type { PrismaService } from "../../src/prisma/prisma.service";

export interface SeededQuiz {
  quizId: string;
  questionIds: string[];
  correctOptionIdByQuestion: Map<string, string[]>;
  optionIdsByQuestion: Map<string, string[]>;
  marksByQuestion: Map<string, number>;
  cleanup: () => Promise<void>;
}

/**
 * Seeds a PUBLISHED quiz with `questionCount` PUBLISHED single-choice
 * questions (one correct option each), assigned with `marksPerQuestion`
 * marks apiece — directly via Prisma (bypasses the assessment services so
 * quiz-attempt tests are self-contained, mirroring test/support/content-seed.ts).
 */
export async function seedPublishedQuiz(
  prisma: PrismaService,
  opts: {
    questionCount?: number;
    marksPerQuestion?: number;
    timeLimitMinutes?: number | null;
    negativeMarkingEnabled?: boolean;
    negativeMarksPerWrong?: number;
    passingScorePercent?: number;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
  } = {},
): Promise<SeededQuiz> {
  const questionCount = opts.questionCount ?? 3;
  const marksPerQuestion = opts.marksPerQuestion ?? 4;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const questionIds: string[] = [];
  const correctOptionIdByQuestion = new Map<string, string[]>();
  const optionIdsByQuestion = new Map<string, string[]>();
  const marksByQuestion = new Map<string, number>();

  for (let i = 0; i < questionCount; i++) {
    const question = await prisma.question.create({
      data: {
        type: "SINGLE_CHOICE",
        difficulty: "MEDIUM",
        text: `Seed question ${i} ${suffix}`,
        status: "PUBLISHED",
        options: {
          create: [
            { text: "Correct", isCorrect: true, position: 0 },
            { text: "Wrong A", isCorrect: false, position: 1 },
            { text: "Wrong B", isCorrect: false, position: 2 },
          ],
        },
      },
      include: { options: { orderBy: { position: "asc" } } },
    });
    questionIds.push(question.id);
    correctOptionIdByQuestion.set(
      question.id,
      question.options.filter((o) => o.isCorrect).map((o) => o.id),
    );
    optionIdsByQuestion.set(
      question.id,
      question.options.map((o) => o.id),
    );
    marksByQuestion.set(question.id, marksPerQuestion);
  }

  const quiz = await prisma.quiz.create({
    data: {
      title: `Seed Quiz ${suffix}`,
      slug: `seed-quiz-${suffix}`,
      status: "PUBLISHED",
      timeLimitMinutes: opts.timeLimitMinutes === undefined ? 30 : opts.timeLimitMinutes,
      passingScorePercent: opts.passingScorePercent ?? 40,
      negativeMarkingEnabled: opts.negativeMarkingEnabled ?? false,
      negativeMarksPerWrong: opts.negativeMarksPerWrong ?? 0,
      shuffleQuestions: opts.shuffleQuestions ?? false,
      shuffleOptions: opts.shuffleOptions ?? false,
      publishedAt: new Date(),
    },
  });

  await prisma.$transaction(
    questionIds.map((questionId, index) =>
      prisma.quizQuestion.create({
        data: { quizId: quiz.id, questionId, marks: marksPerQuestion, position: index },
      }),
    ),
  );

  return {
    quizId: quiz.id,
    questionIds,
    correctOptionIdByQuestion,
    optionIdsByQuestion,
    marksByQuestion,
    cleanup: async () => {
      // Quiz delete cascades sections/quizQuestions/attempts/answers; question
      // delete cascades options (and any remaining quizQuestion/answer rows).
      await prisma.quiz.deleteMany({ where: { id: quiz.id } });
      await prisma.question.deleteMany({ where: { id: { in: questionIds } } });
    },
  };
}
