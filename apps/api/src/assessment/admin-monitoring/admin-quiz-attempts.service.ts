import { Injectable, NotFoundException } from "@nestjs/common";
import type { QuizAttemptStatus } from "@examora/types";
import { decToNum } from "../assessment.mappers";
import { PrismaService } from "../../prisma/prisma.service";
import { QuizAttemptsService } from "../quiz-attempts/quiz-attempts.service";

const ATTEMPT_RELATIONS = {
  quiz: { select: { title: true } },
  user: { select: { email: true } },
} as const;

@Injectable()
export class AdminQuizAttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attemptsService: QuizAttemptsService,
  ) {}

  /**
   * Side-effect-free (ADR-0013/0014 read/write split) — a stale expired
   * IN_PROGRESS row is reported via the derived `effectivelyExpired` flag in
   * the mapper, not auto-finalized on a bulk read.
   */
  async list(params: {
    page: number;
    pageSize: number;
    quizId?: string;
    userId?: string;
    status?: QuizAttemptStatus;
  }) {
    const where = {
      ...(params.quizId ? { quizId: params.quizId } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.status ? { status: params.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.quizAttempt.findMany({
        where,
        include: ATTEMPT_RELATIONS,
        orderBy: { startedAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.quizAttempt.count({ where }),
    ]);
    return { items, total };
  }

  /** A single-attempt read is deliberate enough to trigger the lazy expiry finalize (TD-021). */
  async findDetailOrThrow(id: string) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id },
      include: ATTEMPT_RELATIONS,
    });
    if (!attempt) {
      throw new NotFoundException("Attempt not found");
    }
    const finalized = await this.attemptsService.finalizeIfExpired(attempt);
    const withRelations =
      finalized === attempt
        ? attempt
        : await this.prisma.quizAttempt.findUniqueOrThrow({
            where: { id },
            include: ATTEMPT_RELATIONS,
          });

    const snapshot = withRelations.questionSnapshot as unknown as { questionId: string }[];
    const [questions, answers] = await Promise.all([
      this.prisma.question.findMany({
        where: { id: { in: snapshot.map((s) => s.questionId) } },
        select: { id: true, text: true },
      }),
      this.prisma.quizAttemptAnswer.findMany({ where: { attemptId: id } }),
    ]);
    const questionById = new Map(questions.map((q) => [q.id, q]));
    const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

    return { attempt: withRelations, snapshot, questionById, answerByQuestion };
  }

  async getResultDashboard(quizId: string) {
    const quiz = await this.prisma.quiz.findFirst({ where: { id: quizId, deletedAt: null } });
    if (!quiz) {
      throw new NotFoundException("Quiz not found");
    }
    const attempts = await this.prisma.quizAttempt.findMany({ where: { quizId } });

    const completed = attempts.filter((a) => a.status !== "IN_PROGRESS");
    const percentages = completed.map((a) => decToNum(a.percentage));
    const passCount = completed.filter((a) => a.passed === true).length;

    return {
      quizId,
      quizTitle: quiz.title,
      totalAttempts: attempts.length,
      completedAttempts: completed.length,
      inProgressAttempts: attempts.length - completed.length,
      averagePercentage:
        percentages.length > 0
          ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 100) / 100
          : null,
      passCount,
      failCount: completed.length - passCount,
      passRate:
        completed.length > 0 ? Math.round((passCount / completed.length) * 10000) / 100 : null,
      highestPercentage: percentages.length > 0 ? Math.max(...percentages) : null,
      lowestPercentage: percentages.length > 0 ? Math.min(...percentages) : null,
    };
  }
}
