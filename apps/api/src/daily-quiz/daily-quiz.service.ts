import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DAILY_CATCH_UP_DAYS,
  type DailyAward,
  type DailyBoardRow,
  type DailyCalendarDay,
  type DailyQuizDashboard,
  type DailyQuizQuestion,
  type DailyQuizResult,
  type DailyQuizStatus,
  type DailyStanding,
} from "@examora/types";
import { shortName } from "../assessment/quiz-attempts/attempt-analysis.service";
import { XpService } from "../gamification/xp.service";
import { toExplanationSteps, toResources } from "../assessment/assessment.mappers";
import { PrismaService } from "../prisma/prisma.service";

export const DAILY_QUESTION_COUNT = 10;
export const SECONDS_PER_QUESTION = 10;
export const XP_PER_CORRECT = 3;
/** Questions tagged with this tag (published, single-answer) form the daily pool. */
export const DAILY_TAG = "daily";
const NO_REPEAT_DAYS = 30;
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const CALENDAR_DAYS = 28;

/** Today's date in India, as a UTC-midnight Date (what the @db.Date column stores). */
export function todayInIndia(now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
/** Monday of the (IST) week containing this day. */
export function weekStart(day: Date): Date {
  return addDays(day, -((day.getUTCDay() + 6) % 7));
}
export function monthStart(day: Date): Date {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
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

/** Longest run of consecutive days, and the run ending on `end` (or the day before it). */
export function streaks(days: Set<string>, end: Date): { current: number; best: number } {
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of [...days].sort()) {
    const t = Date.parse(d);
    run = prev !== null && t - prev === DAY_MS ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  // A streak is still alive if today isn't played yet but yesterday was.
  let cursor = days.has(iso(end)) ? end : addDays(end, -1);
  let current = 0;
  while (days.has(iso(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, best };
}

interface SubmittedAnswer {
  questionId: string;
  optionId: string | null;
  ms: number;
}

interface Played {
  userId: string;
  date: string;
  correct: number;
  totalMs: number;
}

interface Ranked {
  userId: string;
  correct: number;
  totalMs: number;
  days: number;
}

/** Sum each player's on-time results within [from, to] and rank them (score, then time). */
export function rankPeriod(rows: Played[], from: string, to: string): Ranked[] {
  const by = new Map<string, Ranked>();
  for (const r of rows) {
    if (r.date < from || r.date > to) continue;
    const t = by.get(r.userId) ?? { userId: r.userId, correct: 0, totalMs: 0, days: 0 };
    t.correct += r.correct;
    t.totalMs += r.totalMs;
    t.days += 1;
    by.set(r.userId, t);
  }
  return [...by.values()].sort((a, b) => b.correct - a.correct || a.totalMs - b.totalMs);
}

/** Where a student stands in a ranked list, and what it takes to climb. */
export function standingOf(ranked: Ranked[], userId: string): DailyStanding {
  const i = ranked.findIndex((r) => r.userId === userId);
  const me = ranked[i];
  if (!me) {
    return {
      rank: null,
      candidates: ranked.length,
      percentile: null,
      correct: 0,
      days: 0,
      toNext: null,
      toTop10: null,
    };
  }
  const above = ranked[i - 1];
  const tenth = ranked[9];
  return {
    rank: i + 1,
    candidates: ranked.length,
    percentile:
      ranked.length > 1 ? Math.round(((ranked.length - 1 - i) / (ranked.length - 1)) * 100) : null,
    correct: me.correct,
    days: me.days,
    toNext: above ? above.correct - me.correct + 1 : null,
    toTop10: i >= 10 && tenth ? tenth.correct - me.correct + 1 : null,
  };
}

/**
 * Daily quiz: 10 questions, 10 s each, one try a day, ranked by score then
 * time. Missed days in the last week can be caught up for half XP; catch-ups
 * never count for leaderboards or streaks, so playing on the day stays fair.
 */
@Injectable()
export class DailyQuizService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
  ) {}

  /**
   * Which paper a student gets on a date: their batch's course paper when its
   * mentor scheduled one (the course's quiz calendar), else the platform paper.
   */
  private async scopeFor(
    userId: string,
    date: Date,
  ): Promise<{ scope: string; questionIds?: string[] }> {
    const cohorts = await this.prisma.cohortMember.findMany({
      where: { userId, cohort: { isActive: true, courseId: { not: null } } },
      orderBy: { joinedAt: "asc" },
      select: { cohort: { select: { courseId: true } } },
    });
    for (const c of cohorts) {
      const plan = await this.prisma.dailyQuizSchedule.findUnique({
        where: { courseId_date: { courseId: c.cohort.courseId!, date } },
        select: { questionIds: true },
      });
      if (plan) return { scope: c.cohort.courseId!, questionIds: plan.questionIds as string[] };
    }
    return { scope: "" };
  }

  /** A day's quiz for a student; picks its questions on first request when `create` is set. */
  private async quizOn(date: Date, create: boolean, userId: string) {
    const { scope, questionIds } = await this.scopeFor(userId, date);
    const existing = await this.prisma.dailyQuiz.findUnique({
      where: { date_scope: { date, scope } },
    });
    if (existing || !create) return existing;
    if (questionIds) {
      try {
        return await this.prisma.dailyQuiz.create({ data: { date, scope, questionIds } });
      } catch {
        return this.prisma.dailyQuiz.findUniqueOrThrow({ where: { date_scope: { date, scope } } });
      }
    }

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
      where: {
        scope: "",
        date: { gte: addDays(date, -NO_REPEAT_DAYS), lte: addDays(date, NO_REPEAT_DAYS) },
      },
      select: { questionIds: true },
    });
    const used = new Set(recent.flatMap((d) => d.questionIds as string[]));
    const seed = date.getTime() / DAY_MS;
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
      return await this.prisma.dailyQuiz.create({ data: { date, scope: "", questionIds: picked } });
    } catch {
      // Another request created this day's quiz first.
      return this.prisma.dailyQuiz.findUniqueOrThrow({
        where: { date_scope: { date, scope: "" } },
      });
    }
  }

  private today(userId: string) {
    return this.quizOn(todayInIndia(), true, userId);
  }

  /** Today, or a past day inside the catch-up window. */
  private parseDay(day?: string): { date: Date; catchUp: boolean } {
    const today = todayInIndia();
    if (!day) return { date: today, catchUp: false };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) {
      throw new BadRequestException("Use a date like 2026-11-20");
    }
    const date = new Date(`${day}T00:00:00.000Z`);
    if (date.getTime() === today.getTime()) return { date, catchUp: false };
    if (date > today) throw new BadRequestException("That quiz isn't out yet");
    if (date < addDays(today, -DAILY_CATCH_UP_DAYS)) {
      throw new BadRequestException(
        `Missed quizzes can be caught up for ${DAILY_CATCH_UP_DAYS} days`,
      );
    }
    return { date, catchUp: true };
  }

  /** Rank among the day's on-time players (catch-ups are never ranked). */
  private async rankOf(dailyQuizId: string, correct: number, totalMs: number, extra = 0) {
    const [ahead, candidates] = await Promise.all([
      this.prisma.dailyQuizAttempt.count({
        where: {
          dailyQuizId,
          catchUp: false,
          finishedAt: { not: null },
          OR: [
            { correctCount: { gt: correct } },
            { correctCount: correct, totalMs: { lt: totalMs } },
          ],
        },
      }),
      this.prisma.dailyQuizAttempt.count({
        where: { dailyQuizId, catchUp: false, finishedAt: { not: null } },
      }),
    ]);
    return { rank: ahead + 1, candidates: candidates + extra };
  }

  async status(userId: string): Promise<DailyQuizStatus> {
    const quiz = await this.today(userId);
    const date = iso(todayInIndia());
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
        where: { dailyQuizId: quiz.id, catchUp: false, finishedAt: { not: null } },
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

  /** Starts (or resumes) today's quiz, or a missed day's quiz when `day` is given. */
  async start(userId: string, day?: string): Promise<DailyQuizQuestion[]> {
    const { date, catchUp } = this.parseDay(day);
    const quiz = await this.quizOn(date, true, userId);
    if (!quiz) throw new NotFoundException("That day's quiz isn't available");
    const existing = await this.prisma.dailyQuizAttempt.findUnique({
      where: { dailyQuizId_userId: { dailyQuizId: quiz.id, userId } },
    });
    if (existing?.finishedAt) {
      throw new ConflictException(
        catchUp ? "You've already taken that day's quiz" : "You've already taken today's quiz",
      );
    }
    if (!existing) {
      await this.prisma.dailyQuizAttempt.create({
        data: { dailyQuizId: quiz.id, userId, catchUp },
      });
    } else if (catchUp) {
      // Left unfinished on the day: it continues as a fresh catch-up.
      await this.prisma.dailyQuizAttempt.update({
        where: { id: existing.id },
        data: { catchUp: true, startedAt: new Date() },
      });
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

  async finish(userId: string, answers: SubmittedAnswer[], day?: string): Promise<DailyQuizResult> {
    const { date } = this.parseDay(day);
    const quiz = await this.quizOn(date, false, userId);
    if (!quiz) throw new NotFoundException("That day's quiz isn't available");
    const attempt = await this.prisma.dailyQuizAttempt.findUnique({
      where: { dailyQuizId_userId: { dailyQuizId: quiz.id, userId } },
    });
    if (!attempt) throw new BadRequestException("Start the quiz first");
    if (attempt.finishedAt) throw new ConflictException("You've already taken this quiz");
    const catchUp = attempt.catchUp;

    const ids = quiz.questionIds as string[];
    const questions = await this.prisma.question.findMany({
      where: { id: { in: ids } },
      include: {
        options: {
          orderBy: { position: "asc" },
          select: { id: true, text: true, isCorrect: true },
        },
      },
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
        text: q?.text ?? "",
        options: (q?.options ?? []).map((o) => ({ id: o.id, text: o.text })),
        explanation: q?.explanation ?? null,
        explanationImageUrl: q?.explanationImageUrl ?? null,
        explanationVideoUrl: q?.explanationVideoUrl ?? null,
        explanationSteps: toExplanationSteps(q?.explanationSteps ?? null),
        resources: toResources(q?.resources ?? null),
      };
    });
    // Reported time can't be more than the real elapsed time.
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
    const xpAmount = catchUp
      ? Math.floor((correctCount * XP_PER_CORRECT) / 2)
      : correctCount * XP_PER_CORRECT;
    const awarded =
      xpAmount > 0 &&
      (await this.xp.award({
        userId,
        amount: xpAmount,
        reason: catchUp ? "DAILY_QUIZ_CATCH_UP" : "DAILY_QUIZ",
        sourceType: "DailyQuiz",
        sourceId: quiz.id,
      }));

    const { rank, candidates } = await this.rankOf(quiz.id, correctCount, totalMs, catchUp ? 1 : 0);
    return {
      date: iso(date),
      catchUp,
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

  /** Top 10 on-time players of a day (today by default). */
  async leaderboard(userId: string, dailyQuizId?: string) {
    const id = dailyQuizId ?? (await this.today(userId))?.id;
    if (!id) return [];
    const rows = await this.prisma.dailyQuizAttempt.findMany({
      where: { dailyQuizId: id, catchUp: false, finishedAt: { not: null } },
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

  // ------------------------------------------------------------ dashboard

  /** Top 10 of a ranked list, plus the student's own row when outside it. */
  private async boardRows(ranked: Ranked[], userId: string): Promise<DailyBoardRow[]> {
    const top = ranked.slice(0, 10).map((r, i) => ({ r, rank: i + 1 }));
    const mine = ranked.findIndex((r) => r.userId === userId);
    if (mine >= 10) top.push({ r: ranked[mine]!, rank: mine + 1 });
    const users = await this.prisma.user.findMany({
      where: { id: { in: top.map((t) => t.r.userId) } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const name = new Map(users.map((u) => [u.id, shortName(u.firstName, u.lastName, u.email)]));
    return top.map(({ r, rank }) => ({
      rank,
      name: name.get(r.userId) ?? "Student",
      correct: r.correct,
      totalMs: r.totalMs,
      days: r.days,
      isMe: r.userId === userId,
    }));
  }

  /**
   * Everything the Daily Quiz page shows: today's status, the student's
   * streaks and accuracy, a 4-week calendar with catch-up days, today/week/
   * month standings, and awards with progress.
   */
  async dashboard(userId: string): Promise<DailyQuizDashboard> {
    const today = todayInIndia();
    const todayIso = iso(today);
    const wStart = weekStart(today);
    const mStart = monthStart(today);
    // Enough history for "last 4 finished weeks" and "last 2 finished months".
    const historyFrom = new Date(
      Math.min(
        addDays(wStart, -28).getTime(),
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 2, 1),
      ),
    );

    const [status, user, mine, everyone, xp] = await Promise.all([
      this.status(userId),
      this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
      this.prisma.dailyQuizAttempt.findMany({
        where: { userId, finishedAt: { not: null } },
        select: {
          correctCount: true,
          totalMs: true,
          catchUp: true,
          dailyQuiz: { select: { date: true, questionIds: true } },
        },
      }),
      this.prisma.dailyQuizAttempt.findMany({
        where: {
          catchUp: false,
          finishedAt: { not: null },
          dailyQuiz: { date: { gte: historyFrom } },
        },
        select: {
          userId: true,
          correctCount: true,
          totalMs: true,
          dailyQuiz: { select: { date: true } },
        },
      }),
      this.prisma.xpEvent.aggregate({
        _sum: { amount: true },
        where: { userId, reason: { in: ["DAILY_QUIZ", "DAILY_QUIZ_CATCH_UP"] } },
      }),
    ]);

    const played: Played[] = everyone.map((a) => ({
      userId: a.userId,
      date: iso(a.dailyQuiz.date),
      correct: a.correctCount ?? 0,
      totalMs: a.totalMs ?? 0,
    }));
    const myRows = mine.map((a) => ({
      date: iso(a.dailyQuiz.date),
      correct: a.correctCount ?? 0,
      total: (a.dailyQuiz.questionIds as string[]).length || DAILY_QUESTION_COUNT,
      totalMs: a.totalMs ?? 0,
      catchUp: a.catchUp,
    }));
    const onTimeDays = new Set(myRows.filter((r) => !r.catchUp).map((r) => r.date));
    const byDate = new Map(myRows.map((r) => [r.date, r]));
    const { current, best } = streaks(onTimeDays, today);

    // Calendar: the last 28 days. Days before the student started (joined, or
    // their first quiz if that's earlier, e.g. imported history) aren't "missed".
    const firstPlayed = myRows.map((r) => r.date).sort()[0];
    const joinedOn = user ? iso(user.createdAt) : todayIso;
    const joined = firstPlayed && firstPlayed < joinedOn ? firstPlayed : joinedOn;
    const catchUpFrom = iso(addDays(today, -DAILY_CATCH_UP_DAYS));
    const calendar: DailyCalendarDay[] = [];
    for (let i = CALENDAR_DAYS - 1; i >= 0; i--) {
      const d = iso(addDays(today, -i));
      const mineThen = byDate.get(d);
      let dayStatus: DailyCalendarDay["status"];
      if (mineThen) dayStatus = mineThen.catchUp ? "catch-up" : "done";
      else if (d === todayIso) dayStatus = "today";
      else if (d < joined || !status.available) dayStatus = "no-quiz";
      else dayStatus = "missed";
      calendar.push({
        date: d,
        status: dayStatus,
        correct: mineThen?.correct ?? null,
        canCatchUp: dayStatus === "missed" && d >= catchUpFrom,
      });
    }

    const last30 = myRows.filter((r) => r.date >= iso(addDays(today, -29)));
    const sum = (xs: number[]) => xs.reduce((t, x) => t + x, 0);
    const accuracy30 =
      last30.length > 0
        ? Math.round((sum(last30.map((r) => r.correct)) / sum(last30.map((r) => r.total))) * 100)
        : null;

    // Standings.
    const todayRanked = rankPeriod(played, todayIso, todayIso);
    const weekRanked = rankPeriod(played, iso(wStart), todayIso);
    const monthRanked = rankPeriod(played, iso(mStart), todayIso);
    const weekStanding = standingOf(weekRanked, userId);
    const monthStanding = standingOf(monthRanked, userId);
    const todayStanding = standingOf(todayRanked, userId);

    // Awards.
    const weekDays = new Map<string, number>();
    for (const d of onTimeDays) {
      const k = iso(weekStart(new Date(`${d}T00:00:00.000Z`)));
      weekDays.set(k, (weekDays.get(k) ?? 0) + 1);
    }
    const monthDays = new Map<string, number>();
    for (const r of myRows)
      monthDays.set(r.date.slice(0, 7), (monthDays.get(r.date.slice(0, 7)) ?? 0) + 1);
    let podium = false;
    for (let w = 1; w <= 4 && !podium; w++) {
      const from = addDays(wStart, -7 * w);
      const r = standingOf(rankPeriod(played, iso(from), iso(addDays(from, 6))), userId);
      podium = r.rank !== null && r.rank <= 3;
    }
    let monthTop10 = false;
    for (let m = 1; m <= 2 && !monthTop10; m++) {
      const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - m, 1));
      const to = addDays(
        new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - m + 1, 1)),
        -1,
      );
      const r = standingOf(rankPeriod(played, iso(from), iso(to)), userId);
      monthTop10 = r.rank !== null && r.rank <= 10;
    }
    const bestScore = Math.max(0, ...myRows.map((r) => r.correct));
    const eightPlus = myRows.filter((r) => r.correct >= 8).length;
    const speedy = myRows.filter((r) => !r.catchUp && r.correct >= 8);
    const fastest = speedy.length > 0 ? Math.min(...speedy.map((r) => r.totalMs)) : null;
    const thisWeekDays = weekDays.get(iso(wStart)) ?? 0;
    const thisMonthDays = monthDays.get(todayIso.slice(0, 7)) ?? 0;
    const rankNote = (s: DailyStanding, period: string) =>
      s.rank
        ? `You're #${s.rank} of ${s.candidates} this ${period}`
        : `Play this ${period} to get ranked`;

    const award = (a: Omit<DailyAward, "progress"> & { progress: number }): DailyAward => ({
      ...a,
      progress: Math.min(a.progress, a.target),
    });
    const awards: DailyAward[] = [
      award({
        key: "streak-3",
        group: "streak",
        title: "On a roll",
        description: "Play 3 days in a row",
        earned: best >= 3,
        progress: best >= 3 ? 3 : current,
        target: 3,
        detail: `Current streak: ${current} ${current === 1 ? "day" : "days"}`,
      }),
      award({
        key: "streak-7",
        group: "streak",
        title: "Week warrior",
        description: "Play 7 days in a row",
        earned: best >= 7,
        progress: best >= 7 ? 7 : current,
        target: 7,
        detail: `Best streak: ${best} ${best === 1 ? "day" : "days"}`,
      }),
      award({
        key: "streak-30",
        group: "streak",
        title: "Unstoppable",
        description: "Play 30 days in a row",
        earned: best >= 30,
        progress: best >= 30 ? 30 : current,
        target: 30,
        detail: `Best streak: ${best} ${best === 1 ? "day" : "days"}`,
      }),
      award({
        key: "week-perfect",
        group: "week",
        title: "Perfect week",
        description: "Play every day from Monday to Sunday",
        earned: [...weekDays.values()].some((n) => n >= 7),
        progress: thisWeekDays,
        target: 7,
        detail: `${thisWeekDays} of 7 days this week`,
      }),
      award({
        key: "week-podium",
        group: "week",
        title: "Weekly podium",
        description: "Finish a week in the top 3",
        earned: podium,
        progress: podium ? 1 : 0,
        target: 1,
        detail: rankNote(weekStanding, "week"),
      }),
      award({
        key: "month-regular",
        group: "month",
        title: "Monthly regular",
        description: "Play 20 days in one month",
        earned: [...monthDays.values()].some((n) => n >= 20),
        progress: thisMonthDays,
        target: 20,
        detail: `${thisMonthDays} days this month`,
      }),
      award({
        key: "month-top10",
        group: "month",
        title: "Monthly top 10",
        description: "Finish a month in the top 10",
        earned: monthTop10,
        progress: monthTop10 ? 1 : 0,
        target: 1,
        detail: rankNote(monthStanding, "month"),
      }),
      award({
        key: "score-perfect",
        group: "score",
        title: "Perfect 10",
        description: "Get every question right",
        earned: bestScore >= DAILY_QUESTION_COUNT,
        progress: bestScore,
        target: DAILY_QUESTION_COUNT,
        detail: `Best score: ${bestScore}/${DAILY_QUESTION_COUNT}`,
      }),
      award({
        key: "score-sharp",
        group: "score",
        title: "Sharp shooter",
        description: "Score 8 or more five times",
        earned: eightPlus >= 5,
        progress: eightPlus,
        target: 5,
        detail: `${eightPlus} ${eightPlus === 1 ? "time" : "times"} so far`,
      }),
      award({
        key: "score-speed",
        group: "score",
        title: "Speedster",
        description: "Score 8+ in under 40 seconds",
        earned: fastest !== null && fastest < 40_000,
        progress: fastest !== null && fastest < 40_000 ? 1 : 0,
        target: 1,
        detail:
          fastest !== null
            ? `Fastest 8+: ${(fastest / 1000).toFixed(1)} s`
            : "Score 8+ on the day to qualify",
      }),
    ];

    const [todayBoard, weekBoard, monthBoard] = await Promise.all([
      this.boardRows(todayRanked, userId),
      this.boardRows(weekRanked, userId),
      this.boardRows(monthRanked, userId),
    ]);

    return {
      today: { ...status, percentile: todayStanding.percentile },
      stats: {
        currentStreak: current,
        bestStreak: best,
        daysPlayed: myRows.length,
        daysThisMonth: thisMonthDays,
        accuracy30,
        xpTotal: xp._sum.amount ?? 0,
      },
      todayBoard,
      week: { start: iso(wStart), standing: weekStanding, board: weekBoard },
      month: { start: iso(mStart), standing: monthStanding, board: monthBoard },
      calendar,
      awards,
      catchUpDays: DAILY_CATCH_UP_DAYS,
    };
  }
}
