"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { Button } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { learnTrail } from "@/components/student/learn-trail";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { PageHeader } from "@/components/ui/page-header";
import { useLearnApi } from "@/lib/learn-api";
import { useQuizApi } from "@/lib/quiz-api";

const LEVEL_LABEL = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" } as const;

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <dt className="text-xs text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-neutral-800 dark:text-white/90">{value}</dd>
      {hint ? <dd className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</dd> : null}
    </div>
  );
}

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

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title={quiz.title}
        trail={learnTrail(crumbs, "topic")}
        actions={
          <div className="flex flex-col items-end gap-1">
            <Button onClick={() => void start()} disabled={!canStart || starting}>
              {starting
                ? "Starting…"
                : data.inProgressAttemptId
                  ? "Resume attempt"
                  : canStart
                    ? data.attemptsUsed > 0
                      ? "Try again"
                      : "Start quiz"
                    : "No attempts left"}
            </Button>
            {startError ? (
              <p role="alert" className="text-xs text-danger-600">
                {startError}
              </p>
            ) : null}
          </div>
        }
      />

      <Card>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Questions" value={quiz.questionCount} />
          <Stat
            label="Attempts"
            value={
              quiz.maxAttempts === null
                ? `${data.attemptsUsed} used`
                : `${data.attemptsUsed} / ${quiz.maxAttempts}`
            }
            hint={attemptsLeft === null ? "Unlimited" : `${attemptsLeft} left`}
          />
          <Stat
            label="Time limit"
            value={quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "None"}
            hint={quiz.level ? `${LEVEL_LABEL[quiz.level]} level` : undefined}
          />
          <Stat
            label="XP"
            value={quiz.xpReward > 0 ? `+${quiz.xpReward}` : "—"}
            hint={
              quiz.xpReward > 0 && quiz.doublesOnPerfect
                ? `+${quiz.xpReward * 2} for a perfect score`
                : undefined
            }
          />
        </dl>

        {data.lastFinishedAttemptId ? (
          <p className="mt-4 text-sm">
            <Link
              href={`/quizzes/attempts/${data.lastFinishedAttemptId}/result`}
              className="font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              See your last result →
            </Link>
          </p>
        ) : null}
      </Card>

      <Card density="compact" className="flex items-start gap-3">
        <IconBadge icon={Info} tone="primary" />
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          <p className="font-medium text-neutral-800 dark:text-white/90">
            How your answers are analysed
          </p>
          <p className="mt-1">
            After each answer you&rsquo;ll say how you got it: you knew it, you ruled options out,
            or you guessed. Your report then separates real knowledge from lucky guesses, shows
            which topics need work, and how you used your time.
          </p>
        </div>
      </Card>
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
