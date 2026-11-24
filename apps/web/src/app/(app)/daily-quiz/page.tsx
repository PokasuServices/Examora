"use client";

import * as React from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  ListOrdered,
  RotateCcw,
  Trophy,
  XCircle,
} from "lucide-react";
import type { DailyQuizQuestion, DailyQuizResult } from "@examora/types";
import { Button, cn } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { StudyImage } from "@/components/student/study-image";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { IconBadge } from "@/components/ui/icon-badge";
import { PageHeader } from "@/components/ui/page-header";
import { QuestionExplanation } from "@/components/student/question-explanation";
import { useXp } from "@/context/XpContext";
import { useStudentApi } from "@/lib/student-api";

type Answer = { questionId: string; optionId: string | null; ms: number };

const RULES = [
  { icon: ListOrdered, label: "10 questions", detail: "New every day, mostly general knowledge" },
  { icon: Clock, label: "10 seconds each", detail: "The next question appears when time runs out" },
  { icon: RotateCcw, label: "One try", detail: "Today's quiz can be taken once" },
  { icon: Trophy, label: "Leaderboard", detail: "Ranked by score, then by time taken" },
];

function Leaderboard({ rows }: { rows: DailyQuizResult["leaderboard"] }) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">
        Today&rsquo;s leaderboard
      </h2>
      <ol className="mt-3 flex flex-col gap-1.5">
        {rows.map((r) => (
          <li
            key={`${r.rank}-${r.name}`}
            className={cn(
              "flex justify-between rounded-md px-3 py-2 text-sm",
              r.isMe
                ? "bg-primary-50 font-medium dark:bg-primary-500/15"
                : "bg-neutral-50 dark:bg-white/[0.03]",
            )}
          >
            <span>
              <span className="mr-3 inline-block w-5 text-right tabular-nums text-neutral-500">
                {r.rank}
              </span>
              {r.name}
            </span>
            <span className="tabular-nums text-neutral-600 dark:text-neutral-400">
              {r.correctCount}/10 · {(r.totalMs / 1000).toFixed(1)} s
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Player({
  questions,
  secondsEach,
  onDone,
}: {
  questions: DailyQuizQuestion[];
  secondsEach: number;
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
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          Question {index + 1} of {questions.length}
        </span>
        <span className="tabular-nums" aria-live="off">
          {Math.ceil(left / 1000)} s
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10"
        role="progressbar"
        aria-label="Time left"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full transition-[width] duration-100 ease-linear",
            pct < 30 ? "bg-danger-500" : "bg-primary-600",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-lg font-medium text-neutral-900 dark:text-white/90">{question.text}</p>
      {question.imageUrl ? <StudyImage src={question.imageUrl} alt="Question figure" /> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {question.options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => record(o.id)}
            className="rounded-md border border-neutral-200 px-4 py-3 text-left text-sm text-neutral-800 hover:border-primary-500 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-800 dark:text-white/90 dark:hover:bg-primary-500/10"
          >
            {o.text}
          </button>
        ))}
      </div>
    </Card>
  );
}

function DailyContent() {
  const api = useStudentApi();
  const { refresh: refreshXp } = useXp();
  const status = useLoad(() => api.dailyStatus(), "daily-status");
  const board = useLoad(() => api.dailyLeaderboard(), "daily-board");
  const [questions, setQuestions] = React.useState<DailyQuizQuestion[] | null>(null);
  const [result, setResult] = React.useState<DailyQuizResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  async function start() {
    setBusy(true);
    setError(null);
    try {
      setQuestions(await api.dailyStart());
    } catch (err) {
      setError(
        (err as { status?: number })?.status === 409
          ? "You've already taken today's quiz."
          : "Couldn't start. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const finish = React.useCallback(
    async (answers: Answer[]) => {
      setQuestions(null);
      setBusy(true);
      try {
        const r = await api.dailyFinish(answers);
        setResult(r);
        if (r.xpAwarded > 0) void refreshXp();
      } catch {
        setError("Couldn't submit your answers.");
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (status.errorStatus !== null)
    return <ErrorPanel status={status.errorStatus} onRetry={status.reload} />;
  if (status.loading || !status.data) return <LoadingPanel />;
  const s = status.data;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title="Daily Quiz" subtitle={today} />

      {questions ? (
        <Player
          questions={questions}
          secondsEach={s.secondsPerQuestion}
          onDone={(a) => void finish(a)}
        />
      ) : result ? (
        <>
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <IconBadge icon={Trophy} tone="success" />
              <div>
                <p className="text-lg font-semibold text-neutral-800 dark:text-white/90">
                  {result.correctCount} / {result.total} correct
                </p>
                <p className="text-sm text-neutral-500">
                  Rank {result.rank} of {result.candidates} · {(result.totalMs / 1000).toFixed(1)} s
                </p>
              </div>
              {result.xpAwarded > 0 ? <Chip tone="warning">+{result.xpAwarded} XP</Chip> : null}
            </div>
            <ol className="mt-4 flex flex-col gap-1.5 text-sm">
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
                            className="mt-0.5 shrink-0 text-success-600"
                            aria-label="Correct"
                          />
                        ) : (
                          <XCircle
                            size={16}
                            className="mt-0.5 shrink-0 text-danger-600"
                            aria-label="Wrong"
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-neutral-800 dark:text-white/90">
                            {i + 1}. {a.text}
                          </span>
                          <span className="block text-xs text-neutral-500">
                            {a.correct ? "Correct" : a.chosenOptionId ? "Wrong" : "No answer"} · see
                            why
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
          </Card>
          <Leaderboard rows={result.leaderboard} />
        </>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-start gap-3">
              <IconBadge icon={CalendarCheck} tone="primary" />
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-neutral-800 dark:text-white/90">
                  Today&rsquo;s quiz
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {!s.available
                    ? "Not available yet: no questions have been added to the daily pool."
                    : s.attempt
                      ? `Done: ${s.attempt.correctCount}/${s.questionCount} correct, rank ${s.attempt.rank} of ${s.attempt.candidates}.`
                      : s.inProgress
                        ? "You started but didn't finish. Starting again continues today's attempt."
                        : "Not taken yet"}
                </p>
              </div>
              {s.available ? (
                <div className="rounded-md bg-neutral-50 px-4 py-2 text-right dark:bg-white/[0.03]">
                  <p className="text-2xl font-semibold tabular-nums text-neutral-800 dark:text-white/90">
                    {s.attemptedCount.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {s.attemptedCount === 1 ? "student has" : "students have"} taken it today
                  </p>
                </div>
              ) : null}
            </div>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {RULES.map(({ icon, label, detail }) => (
                <li
                  key={label}
                  className="flex items-start gap-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
                >
                  <IconBadge icon={icon} size={24} />
                  <span>
                    <span className="block text-sm font-medium text-neutral-800 dark:text-white/90">
                      {label}
                    </span>
                    <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                      {detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {s.available && !s.attempt ? (
              <div className="mt-5">
                <Button onClick={() => void start()} disabled={busy}>
                  {busy ? "Starting…" : "Start today's quiz"}
                </Button>
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="mt-3 text-sm text-danger-600">
                {error}
              </p>
            ) : null}
          </Card>
          {board.data ? <Leaderboard rows={board.data} /> : null}
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
