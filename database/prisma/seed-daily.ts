/**
 * Sample Daily Quiz history so the Daily Quiz dashboard (streaks, today /
 * week / month rankings, awards, catch-up) has something real to show:
 * 40 classmates with a month of results, and the demo student with a live
 * streak, two missed days inside the 7-day catch-up window and one outside it.
 * Idempotent: existing quizzes and attempts are never changed.
 */
import type { PrismaClient } from "../generated/client/index.js";

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;
const DAYS_BACK = 30;
const QUESTIONS = 10;

function todayInIndia(): Date {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

/** Repeatable 0–1 numbers from a seed, so reruns produce the same history. */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand(seed + i) * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Demo student: days ago → correct answers (missing = not played). */
const DEMO_PLAN: Record<number, number> = {
  27: 6,
  25: 5,
  24: 7,
  22: 6,
  20: 8,
  19: 7,
  18: 6,
  17: 9,
  16: 7,
  15: 8,
  14: 6,
  13: 7,
  12: 8,
  // 11: missed (outside the catch-up window)
  10: 7,
  9: 8,
  8: 6,
  7: 9,
  6: 7,
  // 5 and 4: missed, still catchable
  3: 8,
  2: 7,
  1: 9,
};

export async function seedDailyHistory(prisma: PrismaClient, studentId: string): Promise<string> {
  const pool = await prisma.question.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      type: { in: ["SINGLE_CHOICE", "TRUE_FALSE"] },
      tags: { has: "daily" },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (pool.length === 0) return "daily quiz history skipped (no daily questions)";

  const today = todayInIndia();
  const classmates = await prisma.user.findMany({
    where: { email: { endsWith: "@bulk.examora.test" }, id: { not: studentId } },
    orderBy: { email: "asc" },
    take: 40,
    select: { id: true },
  });

  let quizzes = 0;
  let attempts = 0;
  for (let back = DAYS_BACK; back >= 0; back--) {
    const date = new Date(today.getTime() - back * DAY_MS);
    let quiz = await prisma.dailyQuiz.findUnique({ where: { date_scope: { date, scope: "" } } });
    if (!quiz) {
      const ids = shuffle(
        pool.map((q) => q.id),
        date.getTime() / DAY_MS,
      ).slice(0, QUESTIONS);
      quiz = await prisma.dailyQuiz.create({ data: { date, questionIds: ids } });
      quizzes++;
    }
    const count = (quiz.questionIds as string[]).length || QUESTIONS;
    // Evening in India on that day.
    const evening = (minute: number) =>
      new Date(date.getTime() - IST_OFFSET_MS + (18 * 60 + minute) * 60_000);

    const rows: {
      dailyQuizId: string;
      userId: string;
      startedAt: Date;
      finishedAt: Date;
      correctCount: number;
      totalMs: number;
    }[] = [];
    for (const c of classmates) {
      const h = hash(c.id);
      const habit = 0.35 + rand(h) * 0.6; // how often this classmate plays
      const skill = 0.4 + rand(h + 1) * 0.5; // share of answers usually right
      const r = rand(h + back * 7);
      // Today only part of the class has played so far.
      if (r > (back === 0 ? habit * 0.6 : habit)) continue;
      const correct = Math.max(
        1,
        Math.min(count, Math.round(count * skill + (rand(h + back) - 0.5) * 4)),
      );
      const totalMs = Math.round((25 + rand(h + back * 3) * 60) * 1000);
      const minute = Math.floor(rand(h + back * 5) * 240);
      rows.push({
        dailyQuizId: quiz.id,
        userId: c.id,
        startedAt: evening(minute),
        finishedAt: new Date(evening(minute).getTime() + totalMs),
        correctCount: correct,
        totalMs,
      });
    }
    const demo = DEMO_PLAN[back];
    if (demo !== undefined) {
      const totalMs = 30_000 + (back % 5) * 6_000;
      rows.push({
        dailyQuizId: quiz.id,
        userId: studentId,
        startedAt: evening(30),
        finishedAt: new Date(evening(30).getTime() + totalMs),
        correctCount: Math.min(count, demo),
        totalMs,
      });
    }
    const { count: added } = await prisma.dailyQuizAttempt.createMany({
      data: rows,
      skipDuplicates: true,
    });
    attempts += added;
  }
  return `daily quiz history: ${quizzes} days added, ${attempts} attempts`;
}
