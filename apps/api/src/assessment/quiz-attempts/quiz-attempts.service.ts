import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, QuizAttempt } from "@examora/database";
import { shuffle } from "@examora/utils";
import { decToNum } from "../assessment.mappers";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { PrismaService } from "../../prisma/prisma.service";
import { QuizCatalogService } from "../quiz-catalog/quiz-catalog.service";
import type { OptionOrder, QuestionSnapshot } from "./attempt-snapshot.types";
import { computeScore } from "./scoring.util";

@Injectable()
export class QuizAttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: QuizCatalogService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  /**
   * Starts a new attempt, or resumes an existing non-expired IN_PROGRESS one
   * (ADR-0014 — calling "start" again is how a student resumes). Freezes
   * question/option order, marks, and marking rules at this moment. Sprint 8
   * (ADR-0018): gated on the quiz's course entitlement, if it has one.
   */
  async start(quizId: string, userId: string): Promise<{ attempt: QuizAttempt; created: boolean }> {
    const quiz = await this.catalog.getPublishedQuizOrThrow(quizId);
    await this.enrollmentService.assertSubjectCourseAccess(userId, quiz.subjectId);

    const existing = await this.prisma.quizAttempt.findFirst({
      where: { quizId, userId, status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
    });
    if (existing) {
      const finalized = await this.finalizeIfExpired(existing);
      if (finalized.status === "IN_PROGRESS") {
        return { attempt: finalized, created: false };
      }
    }

    const quizQuestions = await this.prisma.quizQuestion.findMany({
      where: { quizId },
      include: { question: { include: { options: { orderBy: { position: "asc" } } } } },
      orderBy: { position: "asc" },
    });
    if (quizQuestions.length === 0) {
      throw new BadRequestException("This quiz has no questions assigned yet");
    }

    const ordered = quiz.shuffleQuestions
      ? this.shuffleWithinSections(quizQuestions)
      : quizQuestions;

    const questionSnapshot: QuestionSnapshot = ordered.map((qq) => ({
      questionId: qq.questionId,
      sectionId: qq.sectionId,
      marks: decToNum(qq.marks),
    }));
    const optionOrder: OptionOrder = {};
    for (const qq of ordered) {
      const optionIds = qq.question.options.map((o) => o.id);
      optionOrder[qq.questionId] = quiz.shuffleOptions ? shuffle(optionIds) : optionIds;
    }
    const totalMarks = questionSnapshot.reduce((sum, q) => sum + q.marks, 0);

    const startedAt = new Date();
    const expiresAt = quiz.timeLimitMinutes
      ? new Date(startedAt.getTime() + quiz.timeLimitMinutes * 60_000)
      : null;

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        questionSnapshot: questionSnapshot as unknown as Prisma.InputJsonValue,
        optionOrder: optionOrder as unknown as Prisma.InputJsonValue,
        passingScorePercent: quiz.passingScorePercent,
        negativeMarkingEnabled: quiz.negativeMarkingEnabled,
        negativeMarksPerWrong: quiz.negativeMarksPerWrong,
        totalMarks,
        startedAt,
        expiresAt,
      },
    });
    return { attempt, created: true };
  }

  /** Full presentation state for an in-progress (or just-viewed) attempt — never carries correctness. */
  async getAttemptState(attemptId: string, userId: string) {
    let attempt = await this.findOwnedAttemptOrThrow(attemptId, userId);
    attempt = await this.finalizeIfExpired(attempt);

    const snapshot = attempt.questionSnapshot as unknown as QuestionSnapshot;
    const optionOrder = attempt.optionOrder as unknown as OptionOrder;
    const questionIds = snapshot.map((s) => s.questionId);

    const [questions, quiz, answers] = await Promise.all([
      this.prisma.question.findMany({
        where: { id: { in: questionIds } },
        include: { options: true },
      }),
      this.prisma.quiz.findUniqueOrThrow({
        where: { id: attempt.quizId },
        select: { title: true },
      }),
      this.prisma.quizAttemptAnswer.findMany({ where: { attemptId: attempt.id } }),
    ]);
    const questionById = new Map(questions.map((q) => [q.id, q]));
    const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

    return {
      attempt,
      quizTitle: quiz.title,
      snapshot,
      optionOrder,
      questionById,
      answerByQuestion,
    };
  }

  /** Idempotent per-question upsert. Rejects once the attempt is no longer IN_PROGRESS. */
  async autosaveAnswer(
    attemptId: string,
    userId: string,
    questionId: string,
    selectedOptionIds: string[],
  ): Promise<void> {
    let attempt = await this.findOwnedAttemptOrThrow(attemptId, userId);
    attempt = await this.finalizeIfExpired(attempt);
    if (attempt.status !== "IN_PROGRESS") {
      throw new ConflictException("This attempt is already finalized");
    }

    const snapshot = attempt.questionSnapshot as unknown as QuestionSnapshot;
    const optionOrder = attempt.optionOrder as unknown as OptionOrder;
    if (!snapshot.some((s) => s.questionId === questionId)) {
      throw new BadRequestException("questionId is not part of this attempt");
    }
    const validOptionIds = new Set(optionOrder[questionId] ?? []);
    if (selectedOptionIds.some((id) => !validOptionIds.has(id))) {
      throw new BadRequestException(
        "selectedOptionIds contains an id not offered for this question",
      );
    }

    const now = new Date();
    await this.prisma.quizAttemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: {
        selectedOptionIds: selectedOptionIds as unknown as Prisma.InputJsonValue,
        answeredAt: now,
      },
      create: {
        attemptId,
        questionId,
        selectedOptionIds: selectedOptionIds as unknown as Prisma.InputJsonValue,
        answeredAt: now,
      },
    });
  }

  /**
   * Idempotent — submitting an already-finalized attempt just returns its
   * stored result. `justSubmitted` tells the caller whether THIS call is the
   * one that performed the transition (vs. a replay or a beat-by-the-clock
   * auto-submit) — used only to decide whether to write an audit entry.
   */
  async submit(
    attemptId: string,
    userId: string,
  ): Promise<{ attempt: QuizAttempt; justSubmitted: boolean }> {
    const initial = await this.findOwnedAttemptOrThrow(attemptId, userId);
    if (initial.status !== "IN_PROGRESS") {
      return { attempt: initial, justSubmitted: false };
    }
    if (initial.expiresAt && new Date() > initial.expiresAt) {
      const attempt = await this.finalize(initial, "AUTO_SUBMITTED", initial.expiresAt);
      return { attempt, justSubmitted: false };
    }
    const { attempt, won } = await this.finalizeAndReport(initial, "SUBMITTED", new Date());
    return { attempt, justSubmitted: won };
  }

  async getResult(attemptId: string, userId: string) {
    let attempt = await this.findOwnedAttemptOrThrow(attemptId, userId);
    attempt = await this.finalizeIfExpired(attempt);
    if (attempt.status === "IN_PROGRESS") {
      throw new BadRequestException("Attempt is still in progress — submit it first");
    }
    const quiz = await this.prisma.quiz.findUniqueOrThrow({
      where: { id: attempt.quizId },
      select: { title: true },
    });
    return { attempt, quizTitle: quiz.title };
  }

  async getReview(attemptId: string, userId: string) {
    let attempt = await this.findOwnedAttemptOrThrow(attemptId, userId);
    attempt = await this.finalizeIfExpired(attempt);
    if (attempt.status === "IN_PROGRESS") {
      throw new BadRequestException("Attempt is still in progress — submit it first");
    }

    const snapshot = attempt.questionSnapshot as unknown as QuestionSnapshot;
    const [questions, quiz, answers] = await Promise.all([
      this.prisma.question.findMany({
        where: { id: { in: snapshot.map((s) => s.questionId) } },
        include: { options: { orderBy: { position: "asc" } } },
      }),
      this.prisma.quiz.findUniqueOrThrow({
        where: { id: attempt.quizId },
        select: { title: true },
      }),
      this.prisma.quizAttemptAnswer.findMany({ where: { attemptId: attempt.id } }),
    ]);
    const questionById = new Map(questions.map((q) => [q.id, q]));
    const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

    return { attempt, quizTitle: quiz.title, snapshot, questionById, answerByQuestion };
  }

  async listHistory(userId: string, params: { page: number; pageSize: number; quizId?: string }) {
    const where = { userId, ...(params.quizId ? { quizId: params.quizId } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.quizAttempt.findMany({
        where,
        include: { quiz: { select: { title: true } } },
        orderBy: { startedAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.quizAttempt.count({ where }),
    ]);
    return { items, total };
  }

  /** Closes an expired IN_PROGRESS attempt out as AUTO_SUBMITTED; a no-op otherwise. */
  async finalizeIfExpired(attempt: QuizAttempt): Promise<QuizAttempt> {
    if (attempt.status !== "IN_PROGRESS" || !attempt.expiresAt || new Date() <= attempt.expiresAt) {
      return attempt;
    }
    return this.finalize(attempt, "AUTO_SUBMITTED", attempt.expiresAt);
  }

  private async finalize(
    attempt: QuizAttempt,
    status: "SUBMITTED" | "AUTO_SUBMITTED",
    submittedAt: Date,
  ): Promise<QuizAttempt> {
    return (await this.finalizeAndReport(attempt, status, submittedAt)).attempt;
  }

  /**
   * Scores and closes an attempt inside a version-guarded transaction
   * (ADR-0014). If a concurrent call already finalized it, the guarded
   * update affects zero rows and we return the winner's persisted result
   * instead of erroring or rescoring (`won: false`) — this is what makes
   * submit idempotent and safe under concurrent submit/auto-submit races.
   */
  private async finalizeAndReport(
    attempt: QuizAttempt,
    status: "SUBMITTED" | "AUTO_SUBMITTED",
    submittedAt: Date,
  ): Promise<{ attempt: QuizAttempt; won: boolean }> {
    const snapshot = attempt.questionSnapshot as unknown as QuestionSnapshot;
    const [answers, questions] = await Promise.all([
      this.prisma.quizAttemptAnswer.findMany({ where: { attemptId: attempt.id } }),
      this.prisma.question.findMany({
        where: { id: { in: snapshot.map((s) => s.questionId) } },
        include: { options: { select: { id: true, isCorrect: true } } },
      }),
    ]);

    const score = computeScore({
      snapshot,
      answers: answers.map((a) => ({
        questionId: a.questionId,
        selectedOptionIds: a.selectedOptionIds as unknown as string[],
      })),
      questions: questions.map((q) => ({
        id: q.id,
        correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      })),
      totalMarks: decToNum(attempt.totalMarks),
      negativeMarkingEnabled: attempt.negativeMarkingEnabled,
      negativeMarksPerWrong: decToNum(attempt.negativeMarksPerWrong),
      passingScorePercent: decToNum(attempt.passingScorePercent),
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const guarded = await tx.quizAttempt.updateMany({
        where: { id: attempt.id, status: "IN_PROGRESS", version: attempt.version },
        data: {
          status,
          submittedAt,
          obtainedMarks: score.obtainedMarks,
          percentage: score.percentage,
          passed: score.passed,
          correctCount: score.correctCount,
          wrongCount: score.wrongCount,
          unansweredCount: score.unansweredCount,
          version: { increment: 1 },
        },
      });
      if (guarded.count === 0) {
        return null;
      }

      for (const a of score.answers) {
        await tx.quizAttemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: a.questionId } },
          update: { isCorrect: a.isCorrect, marksAwarded: a.marksAwarded },
          create: {
            attemptId: attempt.id,
            questionId: a.questionId,
            selectedOptionIds: a.selectedOptionIds as unknown as Prisma.InputJsonValue,
            isCorrect: a.isCorrect,
            marksAwarded: a.marksAwarded,
          },
        });
      }

      return tx.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    });

    if (result) {
      return { attempt: result, won: true };
    }
    // Lost the race — a concurrent call already finalized this attempt; return its result.
    const winner = await this.prisma.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    return { attempt: winner, won: false };
  }

  private async findOwnedAttemptOrThrow(attemptId: string, userId: string): Promise<QuizAttempt> {
    const attempt = await this.prisma.quizAttempt.findFirst({ where: { id: attemptId, userId } });
    if (!attempt) {
      throw new NotFoundException("Attempt not found");
    }
    return attempt;
  }

  /** Shuffles question order within each section (and within the unsectioned group), preserving section order. */
  private shuffleWithinSections<T extends { sectionId: string | null }>(items: T[]): T[] {
    const groups = new Map<string | null, T[]>();
    for (const item of items) {
      const group = groups.get(item.sectionId);
      if (group) {
        group.push(item);
      } else {
        groups.set(item.sectionId, [item]);
      }
    }
    const result: T[] = [];
    for (const group of groups.values()) {
      result.push(...shuffle(group));
    }
    return result;
  }
}
