"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  Brain,
  Clock,
  FileText,
  ListChecks,
  PenLine,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { Button, cn } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { learnTrail } from "@/components/student/learn-trail";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { useLoad } from "@/components/student/use-load";
import { PageHeader } from "@/components/ui/page-header";
import { ToneCard, ToneIcon, type Tone } from "@/components/ui/tone-card";
import { useLearnApi } from "@/lib/learn-api";
import { useQuizApi } from "@/lib/quiz-api";

const LEVEL: Record<"EASY" | "MEDIUM" | "HARD", { label: string; tone: string }> = {
  EASY: {
    label: "Easy",
    tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  MEDIUM: {
    label: "Medium",
    tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  HARD: { label: "Hard", tone: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};

const DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** The three answer methods, in the same colours the report uses. */
const METHODS = [
  {
    label: "Knew it",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  {
    label: "Ruled out options",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    label: "Guessed",
    className: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
];

const STEPS: { tone: Tone; icon: typeof Brain; title: string; body: React.ReactNode }[] = [
  {
    tone: "indigo",
    icon: Brain,
    title: "Answer, then say how",
    body: (
      <>
        After each answer, tell us how you got it:
        <span className="mt-2 flex flex-wrap gap-1.5">
          {METHODS.map((m) => (
            <span
              key={m.label}
              className={cn("rounded-full px-2 py-0.5 text-xs font-medium", m.className)}
            >
              {m.label}
            </span>
          ))}
        </span>
      </>
    ),
  },
  {
    tone: "cyan",
    icon: TrendingUp,
    title: "Get real insights",
    body: "Your report separates real knowledge from lucky guesses, flags topics that need work and shows how you used your time.",
  },
  {
    tone: "emerald",
    icon: Target,
    title: "Score better next time",
    body: "Use the preparation and attempt strategy to know what to revise and which questions to answer first.",
  },
];

function QuizInfoContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const learnApi = useLearnApi();
  const quizApi = useQuizApi();
  const { data, errorStatus, loading, reload } = useLoad(() => learnApi.getQuiz(id), id);
  const [starting, setStarting] = React.useState(false);
  const [startError, setStartError] = React.useState<string | null>(null);

  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !data) return <LoadingPanel />;
  const { quiz, crumbs } = data;
  const attemptsLeft =
    quiz.maxAttempts === null ? null : Math.max(0, quiz.maxAttempts - data.attemptsUsed);
  const canStart = data.inProgressAttemptId !== null || attemptsLeft === null || attemptsLeft > 0;
  const level = quiz.level ? LEVEL[quiz.level] : null;

  async function start() {
    if (data?.inProgressAttemptId) {
      router.push(`/quizzes/attempt/${data.inProgressAttemptId}`);
      return;
    }
    setStarting(true);
    setStartError(null);
    try {
      const attempt = await quizApi.startAttempt(quiz.id);
      router.push(`/quizzes/attempt/${attempt.id}`);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setStartError(
        status === 409
          ? "You've used all your attempts for this quiz."
          : "Couldn't start the quiz. Please try again.",
      );
      setStarting(false);
    }
  }

  const startLabel = starting
    ? "Starting…"
    : data.inProgressAttemptId
      ? "Resume attempt"
      : canStart
        ? data.attemptsUsed > 0
          ? "Try again"
          : "Start attempt"
        : "No attempts left";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title={quiz.title}
        trail={learnTrail(crumbs, "topic")}
        actions={
          quiz.xpReward > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
              <Zap size={16} aria-hidden="true" /> {quiz.xpReward} XP
            </span>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2 text-xs">
        {level ? (
          <span className={cn("rounded-full px-2.5 py-1 font-medium", level.tone)}>
            {level.label} level
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-600 dark:bg-white/5 dark:text-neutral-300">
          <Clock size={13} aria-hidden="true" />
          {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "No time limit"}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ToneCard tone="indigo" index={0} className="flex items-center gap-4 p-5">
          <ToneIcon tone="indigo" icon={ListChecks} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-700/80 dark:text-indigo-300/80">
              Questions
            </p>
            <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
              {quiz.questionCount}
            </p>
          </div>
        </ToneCard>

        <ToneCard tone="cyan" index={1} className="flex items-center gap-4 p-5">
          <ToneIcon tone="cyan" icon={PenLine} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-cyan-700/80 dark:text-cyan-300/80">
              Attempts
            </p>
            <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
              {data.attemptsUsed}
              {quiz.maxAttempts !== null ? (
                <span className="text-base font-normal text-neutral-400">
                  {" "}
                  / {quiz.maxAttempts}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {attemptsLeft === null ? "Unlimited" : `${attemptsLeft} left`}
            </p>
          </div>
        </ToneCard>

        <ToneCard tone="violet" index={2} className="flex items-center gap-4 p-5">
          <ToneIcon tone="violet" icon={FileText} />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-violet-700/80 dark:text-violet-300/80">
              Last attempt
            </p>
            {data.lastFinishedAttemptId && data.lastScore ? (
              <>
                <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
                  {data.lastScore.obtained}
                  <span className="text-base font-normal text-neutral-400">
                    {" "}
                    / {data.lastScore.total}
                  </span>
                </p>
                <Link
                  href={`/quizzes/attempts/${data.lastFinishedAttemptId}/result`}
                  className="mt-1 inline-flex items-center gap-1 rounded-md border border-violet-200 bg-white px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-violet-500/30 dark:bg-transparent dark:text-violet-300"
                >
                  <FileText size={13} aria-hidden="true" /> Report
                  {data.lastScore.submittedAt
                    ? ` · ${DATE.format(new Date(data.lastScore.submittedAt))}`
                    : ""}
                </Link>
              </>
            ) : (
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Not attempted yet
              </p>
            )}
          </div>
        </ToneCard>
      </div>

      <ToneCard
        tone="amber"
        index={3}
        className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <Trophy size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-500" />
          {quiz.xpReward > 0 ? (
            <span>
              Earn{" "}
              <strong className="text-amber-700 dark:text-amber-300">{quiz.xpReward} XP</strong> for
              completing this quiz
              {quiz.doublesOnPerfect ? (
                <>
                  , and <strong className="text-amber-700 dark:text-amber-300">double it</strong> on
                  a perfect score!
                </>
              ) : (
                "."
              )}
            </span>
          ) : (
            <span>Practise this topic and see exactly where you stand.</span>
          )}
        </p>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Button onClick={() => void start()} disabled={!canStart || starting}>
            {startLabel} <ArrowRight size={16} aria-hidden="true" />
          </Button>
          {startError ? (
            <p role="alert" className="text-xs text-danger-600">
              {startError}
            </p>
          ) : null}
        </div>
      </ToneCard>

      <section aria-labelledby="how-analysed">
        <h2
          id="how-analysed"
          className="mb-1 text-center text-lg font-semibold text-neutral-800 dark:text-white/90"
        >
          How we analyse your answers
        </h2>
        <p className="mb-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Not just right or wrong: how you got there.
        </p>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex">
              <ToneCard
                tone={s.tone}
                index={4 + i}
                interactive
                className="flex w-full flex-col gap-3 p-5"
              >
                <div className="flex items-center justify-between">
                  <ToneIcon tone={s.tone} icon={s.icon} size="lg" />
                  <span className="text-3xl font-bold tabular-nums text-neutral-200 dark:text-white/10">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-neutral-800 dark:text-white/90">
                  {s.title}
                </h3>
                <div className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {s.body}
                </div>
              </ToneCard>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

export default function LearnQuizPage() {
  return (
    <RequireAuth>
      <QuizInfoContent />
    </RequireAuth>
  );
}
