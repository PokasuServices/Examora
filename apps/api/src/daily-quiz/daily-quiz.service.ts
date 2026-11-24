import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { DailyQuizQuestion, DailyQuizResult, DailyQuizStatus } from "@examora/types";
import { shortName } from "../assessment/quiz-attempts/attempt-analysis.service";
import { XpService } from "../gamification/xp.service";
import { PrismaService } from "../prisma/prisma.service";

export const DAILY_QUESTION_COUNT = 10;
export const SECONDS_PER_QUESTION = 10;
export const XP_PER_CORRECT = 3;
/** Questions tagged with this tag (published, single-answer) form the daily pool. */
export const DAILY_TAG = "daily";
const NO_REPEAT_DAYS = 30;
const IST_OFFSET_MS = 330 * 60_000;

/** Today's date in India, as a UTC-midnight Date (what the @db.Date column stores). */
export function todayInIndia(now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

/** Deterministic shuffle so a day's pick is stable if two requests race. */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

interface SubmittedAnswer {
  questionId: string;
  optionId: string | null;
  ms: number;
}

/** Daily quiz: 10 questions, 10 s each, one try, ranked by score then time (phase 7). */
@Injectable()
export class DailyQuizService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
  ) {}

  /** Gets (or picks, on first request of the day) today's questions. */
  private async today() {
    const date = todayInIndia();
    const existing = await this.prisma.dailyQuiz.findUnique({ where: { date } });
    if (existing) return existing;

    const pool = await this.prisma.question.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        type: { in: ["SINGLE_CHOICE", "TRUE_FALSE"] },
        tags: { has: DAILY_TAG },
      },
      select: { id: true },
    });
    if (pool.length === 0) return null;
    const recent = await this.prisma.dailyQuiz.findMany({
      where: { date: { gte: new Date(date.getTime() - NO_REPEAT_DAYS * 86_400_000) } },
      select: { questionIds: true },
    });
    const used = new Set(recent.flatMap((d) => d.questionIds as string[]));
    const seed = date.getTime() / 86_400_000;
    const fresh = seededShuffle(
      pool.filter((q) => !used.has(q.id)),
      seed,
    );
    const reused = seededShuffle(
      pool.filter((q) => used.has(q.id)),
      seed,
    );
    const picked = [...fresh, ...reused].slice(0, DAILY_QUESTION_COUNT).map((q) => q.id);
    try {
      return await this.prisma.dailyQuiz.create({ data: { date, questionIds: picked } });
    } catch {
      // Another request created today's quiz first.
      return this.prisma.dailyQuiz.findUniqueOrThrow({ where: { date } });
    }
  }

  private async rankOf(dailyQuizId: string, correct: number, totalMs: number) {
    const [ahead, candidates] = await Promise.all([
      this.prisma.dailyQuizAttempt.count({
        where: {
          dailyQuizId,
          finishedAt: { not: null },
          OR: [
            { correctCount: { gt: correct } },
            { correctCount: correct, totalMs: { lt: totalMs } },
          ],
        },
      }),
      this.prisma.dailyQuizAttempt.count({ where: { dailyQuizId, finishedAt: { not: null } } }),
    ]);
    return { rank: ahead + 1, candidates };
  }

  async status(userId: string): Promise<DailyQuizStatus> {
    const quiz = await this.today();
    const date = todayInIndia().toISOString().slice(0, 10);
    if (!quiz) {
      return {
        date,
        questionCount: 0,
        secondsPerQuestion: SECONDS_PER_QUESTION,
        available: false,
        attempt: null,
        inProgress: false,
        attemptedCount: 0,
      };
    }
    const [attempt, attemptedCount] = await Promise.all([
      this.prisma.dailyQuizAttempt.findUnique({
        where: { dailyQuizId_userId: { dailyQuizId: quiz.id, userId } },
      }),
      this.prisma.dailyQuizAttempt.count({
        where: { dailyQuizId: quiz.id, finishedAt: { not: null } },
      }),
    ]);
    const finished = attempt?.finishedAt
      ? {
          correctCount: attempt.correctCount ?? 0,
          totalMs: attempt.totalMs ?? 0,
          ...(await this.rankOf(quiz.id, attempt.correctCount ?? 0, attempt.totalMs ?? 0)),
        }
      : null;
    return {
      date,
      questionCount: (quiz.questionIds as string[]).length,
      secondsPerQuestion: SECONDS_PER_QUESTION,
      available: true,
      attempt: finished,
      inProgress: Boolean(attempt && !attempt.finishedAt),
      attemptedCount,
    };
  }

  async start(userId: string): Promise<DailyQuizQuestion[]> {
    const quiz = await this.today();
    if (!quiz) throw new NotFoundException("Today's quiz isn't available yet");
    const existing = await this.prisma.dailyQuizAttempt.findUnique({
      where: { dailyQuizId_userId: { dailyQuizId: quiz.id, userId } },
    });
    if (existing?.finishedAt) throw new ConflictException("You've already taken today's quiz");
    if (!existing) {
      await this.prisma.dailyQuizAttempt.create({ data: { dailyQuizId: quiz.id, userId } });
    }
    const ids = quiz.questionIds as string[];
    const questions = await this.prisma.question.findMany({
      where: { id: { in: ids } },
      include: { options: { orderBy: { position: "asc" } } },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));
    return ids
      .map((id) => byId.get(id))
      .filter((q): q is NonNullable<typeof q> => !!q)
      .map((q) => ({
        questionId: q.id,
        text: q.text,
        imageUrl: q.imageUrl,
        options: q.options.map((o) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl })),
      }));
  }

  async finish(userId: string, answers: SubmittedAnswer[]): Promise<DailyQuizResult> {
    const quiz = await this.today();
    if (!quiz) throw new NotFoundException("Today's quiz isn't available");
    const attempt = await this.prisma.dailyQuizAttempt.findUnique({
      where: { dailyQuizId_userId: { dailyQuizId: quiz.id, userId } },
    });
    if (!attempt) throw new BadRequestException("Start today's quiz first");
    if (attempt.finishedAt) throw new ConflictException("You've already taken today's quiz");

    const ids = quiz.questionIds as string[];
    const questions = await this.prisma.question.findMany({
      where: { id: { in: ids } },
      include: { options: { select: { id: true, isCorrect: true } } },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));
    const given = new Map(answers.map((a) => [a.questionId, a]));
    const capMs = SECONDS_PER_QUESTION * 1000;

    let correctCount = 0;
    let totalMs = 0;
    const scored = ids.map((id) => {
      const q = byId.get(id);
      const a = given.get(id);
      const correctOption = q?.options.find((o) => o.isCorrect)?.id ?? null;
      const chosen = a?.optionId && q?.options.some((o) => o.id === a.optionId) ? a.optionId : null;
      const correct = chosen !== null && chosen === correctOption;
      if (correct) correctCount += 1;
      totalMs += Math.max(0, Math.min(capMs, Math.round(a?.ms ?? capMs)));
      return {
        questionId: id,
        chosenOptionId: chosen,
        correctOptionId: correctOption,
        correct,
        ms: a?.ms ?? capMs,
      };
    });
    // Reported time can't be less than plausible nor more than the real elapsed time.
    const elapsed = Date.now() - attempt.startedAt.getTime();
    totalMs = Math.min(totalMs, Math.max(elapsed, 0));

    await this.prisma.dailyQuizAttempt.update({
      where: { id: attempt.id },
      data: {
        finishedAt: new Date(),
        correctCount,
        totalMs,
        answers: scored.map(({ questionId, chosenOptionId, ms }) => ({
          questionId,
          optionId: chosenOptionId,
          ms,
        })),
      },
    });
    const xpAmount = correctCount * XP_PER_CORRECT;
    const awarded = await this.xp.award({
      userId,
      amount: xpAmount,
      reason: "DAILY_QUIZ",
      sourceType: "DailyQuiz",
      sourceId: quiz.id,
    });

    const { rank, candidates } = await this.rankOf(quiz.id, correctCount, totalMs);
    return {
      correctCount,
      total: ids.length,
      totalMs,
      xpAwarded: awarded ? xpAmount : 0,
      rank,
      candidates,
      answers: scored.map(({ ms: _ms, ...rest }) => rest),
      leaderboard: await this.leaderboard(userId, quiz.id),
    };
  }

  async leaderboard(userId: string, dailyQuizId?: string) {
    const id = dailyQuizId ?? (await this.today())?.id;
    if (!id) return [];
    const rows = await this.prisma.dailyQuizAttempt.findMany({
      where: { dailyQuizId: id, finishedAt: { not: null } },
      orderBy: [{ correctCount: "desc" }, { totalMs: "asc" }],
      take: 10,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    return rows.map((r, i) => ({
      rank: i + 1,
      name: shortName(r.user.firstName, r.user.lastName, r.user.email),
      correctCount: r.correctCount ?? 0,
      totalMs: r.totalMs ?? 0,
      isMe: r.userId === userId,
    }));
  }
}
