"use client";

import * as React from "react";
import {
  Award,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  Gauge,
  History,
  Lock,
  Medal,
  Play,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import type {
  DailyAward,
  DailyBoardRow,
  DailyCalendarDay,
  DailyQuizDashboard,
  DailyQuizQuestion,
  DailyQuizResult,
  DailyStanding,
} from "@examora/types";
import { Button, cn } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { QuestionExplanation } from "@/components/student/question-explanation";
import { StudyImage } from "@/components/student/study-image";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { stagger, ToneCard, ToneIcon, toneClasses, type Tone } from "@/components/ui/tone-card";
import { useXp } from "@/context/XpContext";
import { useStudentApi } from "@/lib/student-api";

type Answer = { questionId: string; optionId: string | null; ms: number };

const DAY_LABEL = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const fmtDate = (iso: string) => DAY_LABEL.format(new Date(`${iso}T00:00:00Z`));
const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** Time until the next quiz (midnight in India). */
function useCountdown(): string {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const ist = new Date(now + 330 * 60_000);
  const next =
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1) - 330 * 60_000;
  const mins = Math.max(0, Math.round((next - now) / 60_000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** A friendly line for how today went, always pointing to something to do next. */
function cheer(percentile: number | null, correct: number, total: number): string {
  if (correct === total) return "Perfect score! Nobody can do better than that today.";
  if (percentile === null) return "You're the first to finish today. Set the bar for the class!";
  if (percentile >= 80) return "Brilliant! You're near the top of the class today.";
  if (percentile >= 50) return "Nice work! You beat most of the class today.";
  return "Every day counts. Read the explanations below and come back stronger tomorrow.";
}

// ----------------------------------------------------------------- player

function Player({
  questions,
  secondsEach,
  label,
  onDone,
}: {
  questions: DailyQuizQuestion[];
  secondsEach: number;
  label: string;
  onDone: (answers: Answer[]) => void;
}) {
  const [index, setIndex] = React.useState(0);
  const [left, setLeft] = React.useState(secondsEach * 1000);
  const shownAt = React.useRef(Date.now());
  const answers = React.useRef<Answer[]>([]);
  const question = questions[index];

  const record = React.useCallback(
    (optionId: string | null) => {
      if (!question) return;
      answers.current.push({
        questionId: question.questionId,
        optionId,
        ms: Math.min(secondsEach * 1000, Date.now() - shownAt.current),
      });
      if (index + 1 >= questions.length) {
        onDone(answers.current);
      } else {
        shownAt.current = Date.now();
        setLeft(secondsEach * 1000);
        setIndex((i) => i + 1);
      }
    },
    [question, index, questions.length, secondsEach, onDone],
  );

  React.useEffect(() => {
    const tick = setInterval(() => {
      const remaining = secondsEach * 1000 - (Date.now() - shownAt.current);
      if (remaining <= 0) record(null);
      else setLeft(remaining);
    }, 100);
    return () => clearInterval(tick);
  }, [record, secondsEach]);

  if (!question) return null;
  const pct = (left / (secondsEach * 1000)) * 100;
  return (
    <ToneCard tone="indigo" className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-indigo-700 dark:text-indigo-300">
          {label} · Question {index + 1} of {questions.length}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 font-semibold tabular-nums",
            pct < 30
              ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
              : "bg-white text-neutral-700 dark:bg-white/10 dark:text-neutral-200",
          )}
          aria-live="off"
        >
          {Math.ceil(left / 1000)} s
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-inset ring-neutral-200 dark:bg-white/10 dark:ring-white/10"
        role="progressbar"
        aria-label="Time left"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full transition-[width] duration-100 ease-linear",
            pct < 30 ? "bg-rose-500" : "bg-indigo-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-lg font-medium text-neutral-900 dark:text-white/90">{question.text}</p>
      {question.imageUrl ? <StudyImage src={question.imageUrl} alt="Question figure" /> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {question.options.map((o, i) => (
          <button
            key={o.id}
            type="button"
            onClick={() => record(o.id)}
            className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left text-sm text-neutral-800 transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-soft-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white/90"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              {String.fromCharCode(65 + i)}
            </span>
            {o.text}
          </button>
        ))}
      </div>
    </ToneCard>
  );
}

// ----------------------------------------------------------------- result

function ResultView({ result, onBack }: { result: DailyQuizResult; onBack: () => void }) {
  const percentile =
    result.candidates > 1
      ? Math.round(((result.candidates - result.rank) / (result.candidates - 1)) * 100)
      : null;
  return (
    <div className="flex flex-col gap-6">
      <ToneCard tone={result.catchUp ? "cyan" : "emerald"} className="p-6">
        <div className="flex flex-wrap items-center gap-4">
          <ToneIcon tone={result.catchUp ? "cyan" : "emerald"} icon={Trophy} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {result.catchUp ? `Caught up: ${fmtDate(result.date)}` : "Today's result"}
            </p>
            <p className="text-3xl font-bold tabular-nums text-neutral-900 dark:text-white">
              {result.correctCount}
              <span className="text-lg font-normal text-neutral-400"> / {result.total}</span>
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              {result.catchUp
                ? `This score would have placed you #${result.rank} of ${result.candidates} that day.`
                : `Rank ${result.rank} of ${result.candidates} · ${secs(result.totalMs)}`}
            </p>
          </div>
          {result.xpAwarded > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 motion-safe:animate-fade-up dark:bg-amber-500/20 dark:text-amber-200">
              <Zap size={14} aria-hidden="true" /> +{result.xpAwarded} XP
              {result.catchUp ? " (half)" : ""}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">
          {result.catchUp
            ? "Well done for catching up. Play on the day to climb the leaderboard and grow your streak."
            : cheer(percentile, result.correctCount, result.total)}
        </p>
      </ToneCard>

      <Card>
        <h2 className="text-base font-semibold text-neutral-800 dark:text-white/90">
          Answers and explanations
        </h2>
        <ol className="mt-3 flex flex-col gap-1.5 text-sm">
          {result.answers.map((a, i) => {
            const chosen = a.options.find((o) => o.id === a.chosenOptionId)?.text;
            const right = a.options.find((o) => o.id === a.correctOptionId)?.text;
            return (
              <li key={a.questionId}>
                <details className="group rounded-md border border-neutral-200 dark:border-neutral-800">
                  <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                    {a.correct ? (
                      <CheckCircle2
                        size={16}
                        className="mt-0.5 shrink-0 text-emerald-600"
                        aria-label="Correct"
                      />
                    ) : (
                      <XCircle
                        size={16}
                        className="mt-0.5 shrink-0 text-rose-600"
                        aria-label="Wrong"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-neutral-800 dark:text-white/90">
                        {i + 1}. {a.text}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {a.correct ? "Correct" : a.chosenOptionId ? "Wrong" : "No answer"} · see why
                      </span>
                    </span>
                  </summary>
                  <div className="border-t border-neutral-200 px-3 pb-3 pt-2 dark:border-neutral-800">
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                      Your answer: <strong>{chosen ?? "none"}</strong>
                      {!a.correct && right ? (
                        <>
                          {" "}
                          · Correct answer: <strong>{right}</strong>
                        </>
                      ) : null}
                    </p>
                    <QuestionExplanation
                      explanation={a.explanation}
                      imageUrl={a.explanationImageUrl}
                      videoUrl={a.explanationVideoUrl}
                      steps={a.explanationSteps}
                      resources={a.resources}
                    />
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
        <div className="mt-4">
          <Button variant="outline" onClick={onBack}>
            Back to my Daily Quiz
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------- dashboard parts

function TodayHero({
  d,
  busy,
  error,
  onStart,
}: {
  d: DailyQuizDashboard;
  busy: boolean;
  error: string | null;
  onStart: () => void;
}) {
  const t = d.today;
  const countdown = useCountdown();
  if (!t.available) {
    return (
      <ToneCard tone="slate" className="p-6">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Today&rsquo;s quiz isn&rsquo;t ready yet: no questions have been added to the daily pool.
        </p>
      </ToneCard>
    );
  }
  if (t.attempt) {
    return (
      <ToneCard tone="emerald" className="p-6">
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-4 ring-emerald-200 dark:bg-neutral-900 dark:ring-emerald-500/30">
            <span className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
              {t.attempt.correctCount}
              <span className="text-sm font-normal text-neutral-400">/{t.questionCount}</span>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Today&rsquo;s quiz done
            </p>
            <p className="text-lg font-semibold text-neutral-900 dark:text-white">
              Rank {t.attempt.rank} of {t.attempt.candidates}
              {t.percentile !== null ? (
                <span className="font-normal text-neutral-500">
                  {" "}
                  · ahead of {t.percentile}% of today&rsquo;s players
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-300">
              {cheer(t.percentile, t.attempt.correctCount, t.questionCount)}
            </p>
          </div>
          <div className="text-right text-sm text-neutral-500 dark:text-neutral-400">
            <p className="flex items-center justify-end gap-1">
              <CalendarClock size={14} aria-hidden="true" /> Next quiz in
            </p>
            <p className="text-lg font-semibold tabular-nums text-neutral-800 dark:text-white/90">
              {countdown}
            </p>
          </div>
        </div>
        {d.stats.currentStreak > 0 ? (
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm text-orange-700 ring-1 ring-orange-200 dark:bg-white/5 dark:text-orange-300 dark:ring-orange-500/30">
            <Flame size={15} aria-hidden="true" /> {d.stats.currentStreak}-day streak. Come back
            tomorrow to make it {d.stats.currentStreak + 1}!
          </p>
        ) : null}
      </ToneCard>
    );
  }
  return (
    <ToneCard tone="indigo" className="p-6">
      <div className="flex flex-wrap items-center gap-5">
        <ToneIcon tone="indigo" icon={CalendarCheck} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-neutral-900 dark:text-white">
            {t.inProgress ? "You started today's quiz" : "Today's quiz is ready"}
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            {t.questionCount} questions · {t.secondsPerQuestion} seconds each ·{" "}
            {t.attemptedCount > 0
              ? `${t.attemptedCount} ${t.attemptedCount === 1 ? "classmate has" : "classmates have"} played. Can you beat them?`
              : "Be the first to play today!"}
          </p>
          {d.stats.currentStreak > 0 ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-orange-700 dark:text-orange-300">
              <Flame size={15} aria-hidden="true" /> Play today to keep your {d.stats.currentStreak}
              -day streak
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={onStart} disabled={busy}>
            <Play size={16} aria-hidden="true" />
            {busy ? "Starting…" : t.inProgress ? "Resume" : "Start today's quiz"}
          </Button>
          <span className="text-xs text-neutral-500">{countdown} left today</span>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger-600">
          {error}
        </p>
      ) : null}
    </ToneCard>
  );
}

function StatCards({ d }: { d: DailyQuizDashboard }) {
  const s = d.stats;
  const cards: { tone: Tone; icon: typeof Flame; label: string; value: string; hint: string }[] = [
    {
      tone: "rose",
      icon: Flame,
      label: "Current streak",
      value: `${s.currentStreak} ${s.currentStreak === 1 ? "day" : "days"}`,
      hint: `Best: ${s.bestStreak} ${s.bestStreak === 1 ? "day" : "days"}`,
    },
    {
      tone: "cyan",
      icon: CalendarCheck,
      label: "This month",
      value: `${s.daysThisMonth} ${s.daysThisMonth === 1 ? "day" : "days"}`,
      hint: `${s.daysPlayed} days played in all`,
    },
    {
      tone: "emerald",
      icon: Target,
      label: "Accuracy",
      value: s.accuracy30 === null ? "—" : `${s.accuracy30}%`,
      hint: "Last 30 days",
    },
    {
      tone: "amber",
      icon: Zap,
      label: "XP from Daily Quiz",
      value: s.xpTotal.toLocaleString("en-IN"),
      hint: "3 XP per right answer",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c, i) => (
        <ToneCard key={c.label} tone={c.tone} index={i} className="flex items-start gap-3 p-4">
          <ToneIcon tone={c.tone} icon={c.icon} />
          <div className="min-w-0">
            <p
              className={cn(
                "text-xs font-medium uppercase tracking-wide",
                toneClasses(c.tone).text,
              )}
            >
              {c.label}
            </p>
            <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
              {c.value}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{c.hint}</p>
          </div>
        </ToneCard>
      ))}
    </div>
  );
}

function climbLine(s: DailyStanding, period: string): string {
  if (s.rank === null) return `Play ${period} to get on the board.`;
  if (s.rank === 1) return "You're #1. Keep it up!";
  if (s.rank <= 3) return `On the podium! ${s.toNext} more correct to move up.`;
  if (s.toTop10 !== null) return `${s.toTop10} more correct answers to reach the top 10.`;
  return `${s.toNext} more correct ${s.toNext === 1 ? "answer" : "answers"} to pass the next player.`;
}

function CompareCard({ d }: { d: DailyQuizDashboard }) {
  const today: DailyStanding = {
    rank: d.today.attempt?.rank ?? null,
    candidates: d.today.attemptedCount,
    percentile: d.today.percentile,
    correct: d.today.attempt?.correctCount ?? 0,
    days: d.today.attempt ? 1 : 0,
    toNext: null,
    toTop10: null,
  };
  const items: { label: string; s: DailyStanding; period: string; tone: Tone }[] = [
    { label: "Today", s: today, period: "today", tone: "indigo" },
    { label: "This week", s: d.week.standing, period: "this week", tone: "violet" },
    { label: "This month", s: d.month.standing, period: "this month", tone: "cyan" },
  ];
  return (
    <Card className="motion-safe:animate-fade-up" style={stagger(4)}>
      <div className="mb-4 flex items-center gap-3">
        <ToneIcon tone="violet" icon={TrendingUp} size="sm" />
        <div>
          <h2 className="text-base font-semibold text-neutral-800 dark:text-white/90">
            How you compare
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Ranked by right answers, then by time. Only quizzes played on the day count.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map(({ label, s, period, tone }, i) => (
          <ToneCard key={label} tone={tone} index={i} className="p-4">
            <p
              className={cn("text-xs font-medium uppercase tracking-wide", toneClasses(tone).text)}
            >
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
              {s.rank !== null ? `#${s.rank}` : "—"}
              <span className="text-sm font-normal text-neutral-400"> of {s.candidates}</span>
            </p>
            {s.percentile !== null ? (
              <>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-white ring-1 ring-inset ring-neutral-200 dark:bg-white/10 dark:ring-white/10"
                  role="img"
                  aria-label={`Ahead of ${s.percentile}% of players`}
                >
                  <div
                    className={cn(
                      "h-full origin-left rounded-full motion-safe:animate-grow-x",
                      toneClasses(tone).line,
                    )}
                    style={{ width: `${Math.max(4, s.percentile)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                  Ahead of <strong>{s.percentile}%</strong> of players
                </p>
              </>
            ) : null}
            <p className="mt-2 text-xs font-medium text-neutral-700 dark:text-neutral-200">
              {label === "Today" && s.rank !== null
                ? s.rank <= 3
                  ? "On today's podium!"
                  : "Tomorrow is a new chance to climb."
                : climbLine(s, period)}
            </p>
          </ToneCard>
        ))}
      </div>
    </Card>
  );
}

const CELL: Record<DailyCalendarDay["status"], string> = {
  done: "bg-emerald-500 text-white",
  "catch-up":
    "bg-cyan-100 text-cyan-800 ring-1 ring-inset ring-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-200",
  missed:
    "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300",
  today: "bg-white text-indigo-700 ring-2 ring-indigo-500 dark:bg-neutral-900 dark:text-indigo-300",
  "no-quiz": "bg-neutral-100 text-neutral-400 dark:bg-white/5",
};

function CalendarCard({
  d,
  busy,
  onCatchUp,
}: {
  d: DailyQuizDashboard;
  busy: boolean;
  onCatchUp: (date: string) => void;
}) {
  const first = d.calendar[0];
  // Pad so columns line up with Monday-first weekdays.
  const lead = first ? (new Date(`${first.date}T00:00:00Z`).getUTCDay() + 6) % 7 : 0;
  const catchable = d.calendar.filter((c) => c.canCatchUp).reverse();
  return (
    <Card className="motion-safe:animate-fade-up" style={stagger(5)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ToneIcon tone="cyan" icon={CalendarCheck} size="sm" />
          <div>
            <h2 className="text-base font-semibold text-neutral-800 dark:text-white/90">
              Your last 4 weeks
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Missed a day? You can catch up for {d.catchUpDays} days, for half XP.
            </p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
          <li className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-emerald-500" aria-hidden="true" /> Played
          </li>
          <li className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-cyan-100 ring-1 ring-cyan-300" aria-hidden="true" />{" "}
            Caught up
          </li>
          <li className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-rose-50 ring-1 ring-rose-200" aria-hidden="true" />{" "}
            Missed
          </li>
        </ul>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-neutral-400">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <ol className="mt-1.5 grid grid-cols-7 gap-1.5">
            {Array.from({ length: lead }).map((_, i) => (
              <li key={`pad-${i}`} aria-hidden="true" />
            ))}
            {d.calendar.map((c, i) => {
              const day = Number(c.date.slice(8, 10));
              const label = `${fmtDate(c.date)}: ${
                c.status === "done"
                  ? `played, ${c.correct} right`
                  : c.status === "catch-up"
                    ? `caught up, ${c.correct} right`
                    : c.status === "missed"
                      ? c.canCatchUp
                        ? "missed, can catch up"
                        : "missed"
                      : c.status === "today"
                        ? "today"
                        : "no quiz"
              }`;
              const inner = (
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-xs font-semibold">{day}</span>
                  {c.correct !== null ? (
                    <span className="text-[10px] opacity-90">{c.correct}/10</span>
                  ) : null}
                </span>
              );
              return (
                <li key={c.date} className="motion-safe:animate-fade-up" style={stagger(i, 15)}>
                  {c.canCatchUp ? (
                    <button
                      type="button"
                      title={label}
                      aria-label={`${label}. Catch up now`}
                      disabled={busy}
                      onClick={() => onCatchUp(c.date)}
                      className={cn(
                        "flex h-11 w-full items-center justify-center rounded-md border-2 border-dashed border-amber-400 bg-amber-50 text-amber-800 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:bg-amber-500/10 dark:text-amber-200",
                      )}
                    >
                      {inner}
                    </button>
                  ) : (
                    <span
                      title={label}
                      aria-label={label}
                      role="img"
                      className={cn(
                        "flex h-11 w-full items-center justify-center rounded-md",
                        CELL[c.status],
                      )}
                    >
                      {inner}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
        <div>
          <h3 className="text-sm font-medium text-neutral-800 dark:text-white/90">
            <History size={14} aria-hidden="true" className="mr-1 inline" /> Catch up on missed
            quizzes
          </h3>
          {catchable.length === 0 ? (
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
              Nothing to catch up. You&rsquo;ve played every day you could this week!
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {catchable.map((c, i) => (
                <li key={c.date}>
                  <ToneCard tone="amber" index={i} interactive className="p-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onCatchUp(c.date)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <span>
                        <span className="block text-sm font-medium text-neutral-800 dark:text-white/90">
                          {fmtDate(c.date)}
                        </span>
                        <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                          10 questions · half XP · not ranked
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
                        <Play size={12} aria-hidden="true" /> Catch up
                      </span>
                    </button>
                  </ToneCard>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

const AWARD_GROUPS: { key: DailyAward["group"]; title: string; tone: Tone }[] = [
  { key: "streak", title: "Streak awards", tone: "rose" },
  { key: "week", title: "Week awards", tone: "violet" },
  { key: "month", title: "Month awards", tone: "cyan" },
  { key: "score", title: "Score awards", tone: "amber" },
];
const AWARD_ICON: Record<string, typeof Award> = {
  "streak-3": Flame,
  "streak-7": Flame,
  "streak-30": Crown,
  "week-perfect": Star,
  "week-podium": Medal,
  "month-regular": CalendarCheck,
  "month-top10": Trophy,
  "score-perfect": Sparkles,
  "score-sharp": Target,
  "score-speed": Gauge,
};

function AwardsCard({ awards }: { awards: DailyAward[] }) {
  const earned = awards.filter((a) => a.earned).length;
  return (
    <Card className="motion-safe:animate-fade-up" style={stagger(6)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ToneIcon tone="amber" icon={Award} size="sm" />
          <div>
            <h2 className="text-base font-semibold text-neutral-800 dark:text-white/90">Awards</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {earned} of {awards.length} earned. Each one shows how close you are.
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        {AWARD_GROUPS.map((g) => (
          <div key={g.key}>
            <h3
              className={cn(
                "mb-2 text-xs font-semibold uppercase tracking-wide",
                toneClasses(g.tone).text,
              )}
            >
              {g.title}
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {awards
                .filter((a) => a.group === g.key)
                .map((a, i) => {
                  const Icon = AWARD_ICON[a.key] ?? Award;
                  const pct = Math.round((a.progress / a.target) * 100);
                  return (
                    <li key={a.key} className="flex">
                      <ToneCard
                        tone={a.earned ? g.tone : "slate"}
                        index={i}
                        interactive
                        className={cn(
                          "flex w-full items-start gap-3 p-4",
                          !a.earned && "opacity-90",
                        )}
                      >
                        <span
                          className={cn(
                            "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                            a.earned
                              ? cn(
                                  toneClasses(g.tone).icon,
                                  "ring-2 ring-white shadow-sm dark:ring-neutral-900",
                                )
                              : "bg-neutral-100 text-neutral-400 dark:bg-white/10",
                          )}
                          aria-hidden="true"
                        >
                          <Icon size={20} />
                          {!a.earned ? (
                            <Lock
                              size={11}
                              className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-0.5 text-neutral-500 dark:bg-neutral-800"
                            />
                          ) : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-800 dark:text-white/90">
                            {a.title}
                            {a.earned ? (
                              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                                Earned
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {a.description}
                          </p>
                          {!a.earned && a.target > 1 ? (
                            <div
                              className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10"
                              role="progressbar"
                              aria-label={`${a.title} progress`}
                              aria-valuenow={a.progress}
                              aria-valuemin={0}
                              aria-valuemax={a.target}
                            >
                              <div
                                className={cn(
                                  "h-full origin-left rounded-full motion-safe:animate-grow-x",
                                  toneClasses(g.tone).line,
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          ) : null}
                          <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                            {a.detail}
                          </p>
                        </div>
                      </ToneCard>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BoardRows({ rows, showDays }: { rows: DailyBoardRow[]; showDays: boolean }) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500">Nobody has played yet. Be the first!</p>;
  }
  const medal = [
    "bg-amber-400 text-white",
    "bg-neutral-300 text-neutral-800",
    "bg-orange-300 text-white",
  ];
  return (
    <ol className="flex flex-col gap-1.5">
      {rows.map((r, i) => {
        const gap = i > 0 && r.rank - rows[i - 1]!.rank > 1;
        return (
          <React.Fragment key={`${r.rank}-${r.name}`}>
            {gap ? (
              <li aria-hidden="true" className="text-center text-xs text-neutral-400">
                ⋯
              </li>
            ) : null}
            <li
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm motion-safe:animate-fade-up",
                r.isMe
                  ? "bg-indigo-50 font-semibold ring-1 ring-indigo-200 dark:bg-indigo-500/15 dark:ring-indigo-500/30"
                  : "bg-neutral-50 dark:bg-white/[0.03]",
              )}
              style={stagger(i, 40)}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                    r.rank <= 3 ? medal[r.rank - 1] : "bg-white text-neutral-500 dark:bg-white/10",
                  )}
                >
                  {r.rank}
                </span>
                <span className="truncate">
                  {r.name}
                  {r.isMe ? <span className="ml-1.5 text-xs text-indigo-600">(you)</span> : null}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-neutral-600 dark:text-neutral-400">
                {r.correct} right{showDays ? ` · ${r.days}d` : ""} · {secs(r.totalMs)}
              </span>
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}

function LeaderboardCard({ d }: { d: DailyQuizDashboard }) {
  const [view, setView] = React.useState<"today" | "week" | "month">("today");
  const rows = view === "today" ? d.todayBoard : view === "week" ? d.week.board : d.month.board;
  return (
    <Card className="motion-safe:animate-fade-up" style={stagger(7)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ToneIcon tone="indigo" icon={Trophy} size="sm" />
          <h2 className="text-base font-semibold text-neutral-800 dark:text-white/90">
            Leaderboard
          </h2>
        </div>
        <SegmentedControl
          aria-label="Leaderboard period"
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "This week" },
            { value: "month", label: "This month" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      <BoardRows key={view} rows={rows} showDays={view !== "today"} />
    </Card>
  );
}

// ----------------------------------------------------------------- page

function DailyContent() {
  const api = useStudentApi();
  const { refresh: refreshXp } = useXp();
  const dash = useLoad(() => api.dailyDashboard(), "daily-dashboard");
  const [play, setPlay] = React.useState<{
    date: string | null;
    questions: DailyQuizQuestion[];
  } | null>(null);
  const [result, setResult] = React.useState<DailyQuizResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  async function start(date: string | null) {
    setBusy(true);
    setError(null);
    try {
      const questions = date ? await api.dailyStartDay(date) : await api.dailyStart();
      setPlay({ date, questions });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(
        (err as { status?: number })?.status === 409
          ? "You've already taken that quiz."
          : "Couldn't start. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const finish = React.useCallback(
    async (date: string | null, answers: Answer[]) => {
      setPlay(null);
      setBusy(true);
      try {
        const r = date ? await api.dailyFinishDay(date, answers) : await api.dailyFinish(answers);
        setResult(r);
        if (r.xpAwarded > 0) void refreshXp();
        dash.reload();
      } catch {
        setError("Couldn't submit your answers.");
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (dash.errorStatus !== null)
    return <ErrorPanel status={dash.errorStatus} onRetry={dash.reload} />;
  if (!dash.data) return <LoadingPanel />;
  const d = dash.data;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader title="Daily Quiz" subtitle={todayLabel} />

      {play ? (
        <Player
          questions={play.questions}
          secondsEach={d.today.secondsPerQuestion}
          label={play.date ? `Catch-up: ${fmtDate(play.date)}` : "Today's quiz"}
          onDone={(a) => void finish(play.date, a)}
        />
      ) : result ? (
        <ResultView result={result} onBack={() => setResult(null)} />
      ) : (
        <>
          <TodayHero d={d} busy={busy} error={error} onStart={() => void start(null)} />
          <StatCards d={d} />
          <CompareCard d={d} />
          <CalendarCard d={d} busy={busy} onCatchUp={(date) => void start(date)} />
          <div className="grid items-start gap-6 xl:grid-cols-[1fr_26rem]">
            <AwardsCard awards={d.awards} />
            <LeaderboardCard d={d} />
          </div>
          <ul className="flex flex-wrap justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            {[
              [Clock, `${d.today.secondsPerQuestion} s per question`],
              [CalendarCheck, "New quiz every day at midnight"],
              [History, `Catch up missed days for ${d.catchUpDays} days`],
              [Trophy, "Ranked by score, then time"],
            ].map(([Icon, text]) => {
              const I = Icon as typeof Clock;
              return (
                <li
                  key={text as string}
                  className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 dark:bg-white/5"
                >
                  <I size={12} aria-hidden="true" /> {text as string}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}

export default function DailyQuizPage() {
  return (
    <RequireAuth>
      <DailyContent />
    </RequireAuth>
  );
}
