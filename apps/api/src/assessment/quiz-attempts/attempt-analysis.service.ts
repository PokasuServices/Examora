import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AnswerMethod,
  AttemptAnalysis,
  LeaderboardEntry,
  MethodStats,
  TopicInsight,
  SectionScore,
} from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import { decToNum } from "../assessment.mappers";
import type { QuestionSnapshot } from "./attempt-snapshot.types";

/** Correct answers in at most this many seconds count as time "wisely used". */
const WISE_SECONDS = 90;
const MAX_TOPICS_PER_LIST = 5;

interface FirstAttempt {
  attemptId: string;
  userId: string;
  obtained: number;
  total: number;
  seconds: number;
}

/** "Demo Student" → "Demo S." (leaderboards never show full names). */
export function shortName(first: string | null, last: string | null, email: string): string {
  const f = first?.trim();
  if (!f) return email.split("@")[0] ?? "Student";
  const l = last?.trim();
  return l ? `${f} ${l[0]!.toUpperCase()}.` : f;
}

interface ScoredQuestion {
  marks: number;
  awarded: number;
  /** null = unanswered or pending review */
  correct: boolean | null;
  pending: boolean;
  method: AnswerMethod;
  seconds: number;
  visited: boolean;
  subjectId: string | null;
  subjectTitle: string;
  topicId: string | null;
  topicTitle: string | null;
}

/** Pure analysis of one finished attempt's answers (exported for unit tests). */
export function analyseAnswers(rows: ScoredQuestion[]) {
  const methods: Record<AnswerMethod, MethodStats> = {
    KNOWLEDGE: { attempted: 0, correct: 0, wrong: 0 },
    ELIMINATION: { attempted: 0, correct: 0, wrong: 0 },
    GUESS: { attempted: 0, correct: 0, wrong: 0 },
  };
  let unattempted = 0;
  let marksFromGuesses = 0;
  for (const r of rows) {
    if (r.pending) continue;
    if (r.correct === null) {
      unattempted += 1;
      continue;
    }
    const m = methods[r.method];
    m.attempted += 1;
    if (r.correct) {
      m.correct += 1;
      if (r.method === "GUESS") marksFromGuesses += r.awarded;
    } else {
      m.wrong += 1;
    }
  }

  // Subjects
  const subjects = new Map<
    string,
    { subjectId: string | null; title: string; correct: number; total: number }
  >();
  for (const r of rows) {
    const key = r.subjectId ?? "none";
    const s = subjects.get(key) ?? {
      subjectId: r.subjectId,
      title: r.subjectTitle,
      correct: 0,
      total: 0,
    };
    s.total += 1;
    if (r.correct) s.correct += 1;
    subjects.set(key, s);
  }

  // Topics (guesses count as wrong for "true" figures)
  const topics = new Map<
    string,
    TopicInsight & { knowledgeWrong: number; skipped: number; answered: number }
  >();
  rows.forEach((r, index) => {
    if (!r.topicId || r.pending) return;
    const t = topics.get(r.topicId) ?? {
      topicId: r.topicId,
      topicTitle: r.topicTitle ?? "Topic",
      subjectTitle: r.subjectTitle,
      correct: 0,
      total: 0,
      trueScore: 0,
      available: 0,
      timeSeconds: 0,
      gain: 0,
      reason: "",
      byMethod: {
        KNOWLEDGE: { answered: 0, correct: 0 },
        ELIMINATION: { answered: 0, correct: 0 },
        GUESS: { answered: 0, correct: 0 },
      },
      questionNumbers: [],
      knowledgeWrong: 0,
      skipped: 0,
      answered: 0,
    };
    t.total += 1;
    t.questionNumbers.push(index + 1);
    t.available += r.marks;
    t.timeSeconds += r.seconds;
    if (r.correct === null) t.skipped += 1;
    else {
      t.answered += 1;
      t.byMethod[r.method].answered += 1;
      if (r.correct) t.byMethod[r.method].correct += 1;
    }
    const trulyCorrect = r.correct === true && r.method !== "GUESS";
    if (trulyCorrect) {
      t.correct += 1;
      t.trueScore += Math.max(0, r.awarded);
    }
    if (r.correct === false && r.method === "KNOWLEDGE") t.knowledgeWrong += 1;
    topics.set(r.topicId, t);
  });
  const weak: TopicInsight[] = [];
  const opportunity: TopicInsight[] = [];
  const strong: TopicInsight[] = [];
  for (const t of topics.values()) {
    t.trueScore = Math.round(t.trueScore * 100) / 100;
    t.gain = Math.round((t.available - t.trueScore) * 100) / 100;
    const { knowledgeWrong, skipped, answered, ...insight } = t;
    if (knowledgeWrong > 0) {
      insight.reason = `${knowledgeWrong} answer${knowledgeWrong === 1 ? "" : "s"} you were sure of ${knowledgeWrong === 1 ? "was" : "were"} wrong`;
      weak.push(insight);
    } else if (t.correct === t.total && t.trueScore >= t.available) {
      insight.reason = "Full marks, from knowledge or elimination";
      strong.push(insight);
    } else {
      insight.reason =
        skipped > 0 && answered === 0
          ? "Not attempted"
          : skipped > 0
            ? `${skipped} question${skipped === 1 ? "" : "s"} skipped`
            : t.correct === t.total
              ? "Part marks only"
              : "Some answers were guesses or wrong";
      opportunity.push(insight);
    }
  }
  const byGain = (a: TopicInsight, b: TopicInsight) => b.gain - a.gain;
  weak.sort(byGain);
  opportunity.sort(byGain);

  // Attempt order: marks per second, best first.
  const timed = [...topics.values()]
    .filter((t) => t.answered > 0)
    .map(({ knowledgeWrong: _k, skipped: _s, answered: _a, ...t }) => t)
    .sort(
      (a, b) => b.trueScore / Math.max(b.timeSeconds, 1) - a.trueScore / Math.max(a.timeSeconds, 1),
    );
  const half = Math.ceil(timed.length / 2);
  const attemptOrder = {
    first: timed.slice(0, Math.min(half, MAX_TOPICS_PER_LIST)),
    last: timed.slice(half).slice(-MAX_TOPICS_PER_LIST),
  };

  // Time
  const answered = rows.filter((r) => r.correct !== null && !r.pending);
  const bucket = (label: string, pick: (r: ScoredQuestion) => boolean) => {
    const inBucket = answered.filter(pick);
    return {
      label,
      questions: inBucket.length,
      accuracy:
        inBucket.length === 0
          ? null
          : Math.round((inBucket.filter((r) => r.correct).length / inBucket.length) * 100),
    };
  };
  const sum = (list: ScoredQuestion[]) => ({
    questions: list.length,
    seconds: list.reduce((acc, r) => acc + r.seconds, 0),
  });
  const timeBuckets = [
    bucket("Under 30 s", (r) => r.seconds < 30),
    bucket("30–90 s", (r) => r.seconds >= 30 && r.seconds <= WISE_SECONDS),
    bucket("Over 90 s", (r) => r.seconds > WISE_SECONDS),
  ];
  const timeUsage = {
    wiselyUsed: sum(answered.filter((r) => r.correct && r.seconds <= WISE_SECONDS)),
    overSpent: sum(answered.filter((r) => r.correct && r.seconds > WISE_SECONDS)),
    lost: sum(answered.filter((r) => r.correct === false)),
    wasted: sum(rows.filter((r) => r.correct === null && !r.pending && r.seconds > 0)),
  };

  return {
    methods,
    unattempted,
    marksFromGuesses: Math.round(marksFromGuesses * 100) / 100,
    subjects: [...subjects.values()].map((s) => ({
      ...s,
      percent: s.total === 0 ? 0 : Math.round((s.correct / s.total) * 100),
    })),
    weakTopics: weak,
    opportunityTopics: opportunity,
    strongTopics: strong,
    attemptOrder,
    timeBuckets,
    timeUsage,
  };
}

/** Report insights and rankings for a finished attempt (student module redesign, phase 5). */
@Injectable()
export class AttemptAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadFinished(attemptId: string, userId: string) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        quiz: {
          select: {
            title: true,
            practiceCategoryId: true,
            topic: {
              select: {
                id: true,
                title: true,
                subject: { select: { course: { select: { title: true } } } },
              },
            },
            // Practice papers: sketch questions are Part B, reported separately.
            _count: { select: { quizQuestions: { where: { question: { type: "UPLOAD" } } } } },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException("Attempt not found");
    if (attempt.status === "IN_PROGRESS") {
      throw new BadRequestException("Submit the attempt first");
    }
    return attempt;
  }

  /** Each user's first finished attempt of the quiz (rankings use first attempts only). */
  private async firstAttempts(quizId: string): Promise<FirstAttempt[]> {
    const rows = await this.prisma.quizAttempt.findMany({
      where: { quizId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
      select: {
        id: true,
        userId: true,
        obtainedMarks: true,
        totalMarks: true,
        startedAt: true,
        submittedAt: true,
      },
      orderBy: { startedAt: "asc" },
    });
    const firsts = new Map<string, FirstAttempt>();
    for (const r of rows) {
      if (firsts.has(r.userId)) continue;
      firsts.set(r.userId, {
        attemptId: r.id,
        userId: r.userId,
        obtained: decToNum(r.obtainedMarks),
        total: decToNum(r.totalMarks),
        seconds: r.submittedAt
          ? Math.round((r.submittedAt.getTime() - r.startedAt.getTime()) / 1000)
          : 0,
      });
    }
    return [...firsts.values()];
  }

  private static better(a: FirstAttempt, b: FirstAttempt): boolean {
    return a.obtained > b.obtained || (a.obtained === b.obtained && a.seconds < b.seconds);
  }

  /**
   * Which of the student's attempts this is, and the quiz XP awarded while it
   * was the latest one (XP is recorded per quiz, so we bound it by the next
   * attempt's start).
   */
  private async attemptMeta(attempt: {
    id: string;
    userId: string;
    quizId: string;
    startedAt: Date;
  }): Promise<{ attemptNumber: number; xpEarned: number }> {
    const [earlier, next] = await Promise.all([
      this.prisma.quizAttempt.count({
        where: {
          userId: attempt.userId,
          quizId: attempt.quizId,
          OR: [
            { startedAt: { lt: attempt.startedAt } },
            { startedAt: attempt.startedAt, id: { lt: attempt.id } },
          ],
        },
      }),
      this.prisma.quizAttempt.findFirst({
        where: {
          userId: attempt.userId,
          quizId: attempt.quizId,
          startedAt: { gt: attempt.startedAt },
        },
        orderBy: { startedAt: "asc" },
        select: { startedAt: true },
      }),
    ]);
    const xp = await this.prisma.xpEvent.aggregate({
      _sum: { amount: true },
      where: {
        userId: attempt.userId,
        sourceId: attempt.quizId,
        createdAt: { gte: attempt.startedAt, ...(next ? { lt: next.startedAt } : {}) },
      },
    });
    return { attemptNumber: earlier + 1, xpEarned: xp._sum.amount ?? 0 };
  }

  async analyse(attemptId: string, userId: string): Promise<AttemptAnalysis> {
    const attempt = await this.loadFinished(attemptId, userId);
    const snapshot = attempt.questionSnapshot as unknown as QuestionSnapshot;
    const [answers, questions] = await Promise.all([
      this.prisma.quizAttemptAnswer.findMany({ where: { attemptId } }),
      this.prisma.question.findMany({
        where: { id: { in: snapshot.map((s) => s.questionId) } },
        select: {
          id: true,
          type: true,
          subjectId: true,
          subject: { select: { title: true } },
          topicId: true,
          topic: { select: { title: true } },
        },
      }),
    ]);
    const answerBy = new Map(answers.map((a) => [a.questionId, a]));
    const questionBy = new Map(questions.map((q) => [q.id, q]));

    const rows: ScoredQuestion[] = snapshot.map((s) => {
      const a = answerBy.get(s.questionId);
      const q = questionBy.get(s.questionId);
      const pending = q?.type === "UPLOAD" && a?.uploadAssetId != null && a.isCorrect === null;
      return {
        marks: s.marks,
        awarded: a?.marksAwarded != null ? decToNum(a.marksAwarded) : 0,
        correct: a?.isCorrect ?? null,
        pending,
        // Answers without a stated method count as knowledge.
        method: a?.method ?? "KNOWLEDGE",
        seconds: a?.timeSpentSeconds ?? 0,
        visited: a?.visitedAt != null,
        subjectId: q?.subjectId ?? null,
        subjectTitle: q?.subject?.title ?? "General",
        topicId: q?.topicId ?? null,
        topicTitle: q?.topic?.title ?? null,
      };
    });
    const insight = analyseAnswers(rows);

    const sectionRows = await this.prisma.quizSection.findMany({
      where: { quizId: attempt.quizId },
      orderBy: { position: "asc" },
      select: { id: true, title: true },
    });
    // Only sections this attempt had questions in (practice Part B is reported separately).
    const sections: SectionScore[] = sectionRows
      .filter((sec) => snapshot.some((x) => x.sectionId === sec.id))
      .map((sec) => {
        const inSection = snapshot
          .map((s, i) => ({ s, r: rows[i]! }))
          .filter(({ s }) => s.sectionId === sec.id);
        return {
          sectionId: sec.id,
          title: sec.title,
          questionCount: inSection.length,
          obtained: Math.round(inSection.reduce((t, x) => t + x.r.awarded, 0) * 100) / 100,
          total: Math.round(inSection.reduce((t, x) => t + x.r.marks, 0) * 100) / 100,
          correct: inSection.filter((x) => x.r.correct === true).length,
          wrong: inSection.filter((x) => x.r.correct === false).length,
          unattempted: inSection.filter((x) => x.r.correct === null && !x.r.pending).length,
          pending: inSection.filter((x) => x.r.pending).length,
        };
      });

    const obtained = decToNum(attempt.obtainedMarks);
    const total = decToNum(attempt.totalMarks);
    const seconds = attempt.submittedAt
      ? Math.round((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000)
      : 0;
    const me: FirstAttempt = { attemptId, userId, obtained, total, seconds };
    const others = (await this.firstAttempts(attempt.quizId)).filter((f) => f.userId !== userId);
    const ahead = others.filter((o) => AttemptAnalysisService.better(o, me)).length;
    const below = others.filter((o) => AttemptAnalysisService.better(me, o)).length;
    const { attemptNumber, xpEarned } = await this.attemptMeta(attempt);

    return {
      attemptId,
      quizId: attempt.quizId,
      quizTitle: attempt.quiz.title,
      topic: attempt.quiz.topic
        ? {
            id: attempt.quiz.topic.id,
            title: attempt.quiz.topic.title,
            courseTitle: attempt.quiz.topic.subject?.course?.title ?? null,
          }
        : null,
      isPractice: attempt.quiz.practiceCategoryId !== null,
      attemptNumber,
      status: attempt.status === "AUTO_SUBMITTED" ? "AUTO_SUBMITTED" : "SUBMITTED",
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      xpEarned,
      partBCount: attempt.quiz.practiceCategoryId ? attempt.quiz._count.quizQuestions : 0,
      obtainedMarks: obtained,
      totalMarks: total,
      trueScore: Math.round((obtained - insight.marksFromGuesses) * 100) / 100,
      marksFromGuesses: insight.marksFromGuesses,
      rank: ahead + 1,
      candidates: others.length + 1,
      percentile: others.length === 0 ? null : Math.round((below / others.length) * 100),
      methods: insight.methods,
      unattempted: insight.unattempted,
      subjects: insight.subjects,
      sections,
      weakTopics: insight.weakTopics,
      opportunityTopics: insight.opportunityTopics,
      strongTopics: insight.strongTopics,
      attemptOrder: insight.attemptOrder,
      totalTimeSeconds: seconds,
      timeBuckets: insight.timeBuckets,
      timeUsage: insight.timeUsage,
    };
  }

  /** Top 5 first attempts (score, then time), plus the caller's own position if outside them. */
  async leaderboard(attemptId: string, userId: string): Promise<LeaderboardEntry[]> {
    const attempt = await this.loadFinished(attemptId, userId);
    const firsts = (await this.firstAttempts(attempt.quizId)).sort((a, b) =>
      AttemptAnalysisService.better(a, b) ? -1 : AttemptAnalysisService.better(b, a) ? 1 : 0,
    );
    const top = firsts.slice(0, 5);
    const mine = firsts.findIndex((f) => f.userId === userId);
    const picks = mine >= 5 ? [...top, firsts[mine]!] : top;
    const users = await this.prisma.user.findMany({
      where: { id: { in: picks.map((p) => p.userId) } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const userBy = new Map(users.map((u) => [u.id, u]));
    return picks.map((p) => {
      const u = userBy.get(p.userId);
      return {
        rank: firsts.indexOf(p) + 1,
        name: u ? shortName(u.firstName, u.lastName, u.email) : "Student",
        obtainedMarks: p.obtained,
        totalMarks: p.total,
        timeSeconds: p.seconds,
        isMe: p.userId === userId,
      };
    });
  }
}
