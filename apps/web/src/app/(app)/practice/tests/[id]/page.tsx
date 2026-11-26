"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Info, Lock } from "lucide-react";
import { Button, cn } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { PartBSketching } from "@/components/student/part-b-sketching";
import { ShareTestCard } from "@/components/student/share-test-card";
import { TestSections } from "@/components/student/test-sections";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { IconBadge } from "@/components/ui/icon-badge";
import { PageHeader } from "@/components/ui/page-header";
import { useQuizApi } from "@/lib/quiz-api";
import { useStudentApi } from "@/lib/student-api";

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <dt className="text-xs text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-neutral-800 dark:text-white/90">{value}</dd>
      {hint ? <dd className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</dd> : null}
    </div>
  );
}

function TestContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useStudentApi();
  const quizApi = useQuizApi();
  const { data, errorStatus, loading, reload } = useLoad(() => api.practiceTest(id), id);
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Part A = the timed test; Part B = sketching, untimed (?part=b opens it).
  const [part, setPart] = React.useState<"a" | "b">("a");
  const partsId = React.useId();

  // Opened from a classmate's share link: count the visit once, then tidy the URL.
  const apiRef = React.useRef(api);
  apiRef.current = api;
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("part") === "b") setPart("b");
    const ref = params.get("ref");
    if (!ref) return;
    void apiRef.current.visitTestShare(ref).catch(() => undefined);
    params.delete("ref");
    const rest = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
  }, []);

  function choosePart(p: "a" | "b") {
    setPart(p);
    window.history.replaceState(null, "", window.location.pathname + (p === "b" ? "?part=b" : ""));
  }

  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !data) return <LoadingPanel />;

  const attemptsLeft =
    data.maxAttempts === null ? null : Math.max(0, data.maxAttempts - data.attemptsUsed);
  const locked = data.lockedBy !== null;
  const canStart =
    !locked && (data.inProgressAttemptId !== null || attemptsLeft === null || attemptsLeft > 0);

  async function start() {
    if (data?.inProgressAttemptId) {
      router.push(`/quizzes/attempt/${data.inProgressAttemptId}`);
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const attempt = await quizApi.startAttempt(id);
      router.push(`/quizzes/attempt/${attempt.id}`);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setError(
        status === 409
          ? "You've used all your attempts for this test."
          : status === 403
            ? "This test is locked or not assigned to you."
            : "Couldn't start the test. Please try again.",
      );
      setStarting(false);
    }
  }

  const rules = [
    data.timeLimitMinutes
      ? `The timer runs for ${data.timeLimitMinutes} minutes and the test submits itself when it ends.`
      : null,
    "After each answer, say how you got it: you knew it, ruled options out, or guessed.",
    data.requireAllVisited ? "Open every question at least once before you can submit." : null,
    data.negativeMarking
      ? "Wrong answers lose marks, so skip questions you can't narrow down."
      : null,
    "Flag questions to come back to; your answers save as you go.",
  ].filter((r): r is string => r !== null);

  const hasPartB = data.sketchCount > 0;
  const showB = hasPartB && part === "b";
  const startLabel = starting
    ? "Starting…"
    : locked
      ? "Locked"
      : data.inProgressAttemptId
        ? "Resume test"
        : canStart
          ? data.attemptsUsed > 0
            ? "Take again"
            : hasPartB
              ? "Start Part A"
              : "Start test"
          : "No attempts left";

  const partTabs = [
    {
      key: "a" as const,
      label: "Part A: Aptitude",
      hint: `${data.questionCount} questions · ${data.timeLimitMinutes ? `${data.timeLimitMinutes} min` : "untimed"}`,
    },
    {
      key: "b" as const,
      label: "Part B: Sketching",
      hint: `${data.sketchCount} ${data.sketchCount === 1 ? "question" : "questions"} · untimed`,
    },
  ];

  return (
    <main className={cn("mx-auto flex w-full flex-col gap-6", showB ? "max-w-6xl" : "max-w-4xl")}>
      <PageHeader
        title={data.title}
        trail={[
          { label: "Practice", href: "/practice" },
          ...(data.crumbs.category ? [{ label: data.crumbs.category.title }] : []),
        ]}
        actions={
          showB ? null : (
            <div className="flex flex-col items-end gap-1">
              <Button onClick={() => void start()} disabled={!canStart || starting}>
                {startLabel}
              </Button>
              {error ? (
                <p role="alert" className="text-xs text-danger-600">
                  {error}
                </p>
              ) : null}
            </div>
          )
        }
      />

      {hasPartB ? (
        <div
          role="tablist"
          aria-label="Paper parts"
          className="grid grid-cols-2 gap-2 rounded-lg bg-neutral-100 p-1 dark:bg-white/[0.04]"
        >
          {partTabs.map((t) => (
            <button
              key={t.key}
              id={`${partsId}-${t.key}`}
              type="button"
              role="tab"
              aria-selected={part === t.key}
              aria-controls={`${partsId}-panel`}
              onClick={() => choosePart(t.key)}
              className={cn(
                "rounded-md px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                part === t.key
                  ? "bg-white shadow-sm dark:bg-neutral-900"
                  : "hover:bg-white/60 dark:hover:bg-white/5",
              )}
            >
              <span
                className={cn(
                  "block text-sm font-medium",
                  part === t.key
                    ? "text-primary-700 dark:text-primary-300"
                    : "text-neutral-700 dark:text-neutral-300",
                )}
              >
                {t.label}
              </span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">{t.hint}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div
        id={`${partsId}-panel`}
        role={hasPartB ? "tabpanel" : undefined}
        aria-labelledby={hasPartB ? `${partsId}-${part}` : undefined}
        className="flex flex-col gap-6"
      >
        {showB ? (
          <PartBSketching quizId={id} />
        ) : (
          <>
            {locked ? (
              <Card density="compact" className="flex items-center gap-3">
                <IconBadge icon={Lock} tone="warning" />
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  Finish{" "}
                  <Link
                    href={`/practice/tests/${data.lockedBy!.id}`}
                    className="font-medium text-primary-600 hover:underline"
                  >
                    {data.lockedBy!.title}
                  </Link>{" "}
                  to unlock this test.
                </p>
              </Card>
            ) : null}

            <Card>
              {data.exam || data.paperYear ? (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <Chip tone="primary">
                    {[data.exam, data.paperYear].filter(Boolean).join(" · ")}
                  </Chip>
                </div>
              ) : null}
              {data.description ? (
                <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                  {data.description}
                </p>
              ) : null}
              {data.note ? (
                <p className="mb-4 rounded-md bg-warning-50 px-3 py-2 text-sm text-warning-800 dark:bg-warning-500/10 dark:text-warning-200">
                  {data.note}
                </p>
              ) : null}
              <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat
                  label={hasPartB ? "Part A questions" : "Questions"}
                  value={data.questionCount}
                  hint={`${data.totalMarks} marks`}
                />
                <Stat
                  label="Time"
                  value={data.timeLimitMinutes ? `${data.timeLimitMinutes} min` : "Untimed"}
                />
                <Stat
                  label="Attempts"
                  value={
                    data.maxAttempts === null
                      ? `${data.attemptsUsed} used`
                      : `${data.attemptsUsed} / ${data.maxAttempts}`
                  }
                  hint={attemptsLeft === null ? "Unlimited" : `${attemptsLeft} left`}
                />
                <Stat
                  label="XP"
                  value={data.xpReward > 0 ? `+${data.xpReward}` : "—"}
                  hint={
                    data.perfectBonusXp > 0
                      ? `on your first finish, +${data.perfectBonusXp} more for 100%`
                      : "on your first finish"
                  }
                />
              </dl>

              <div className="mt-6">
                <TestSections sections={data.sections} />
              </div>

              {data.lastScore ? (
                <p className="mt-4 text-sm">
                  <Link
                    href={`/quizzes/attempts/${data.lastScore.attemptId}/result`}
                    className="font-medium text-primary-600 hover:underline dark:text-primary-400"
                  >
                    Open your {hasPartB ? "Part A " : ""}report ({data.lastScore.obtained} /{" "}
                    {data.lastScore.total}) →
                  </Link>
                </p>
              ) : null}
              {hasPartB ? (
                <p className="mt-3 rounded-md bg-primary-50 px-3 py-2 text-sm text-primary-800 dark:bg-primary-500/10 dark:text-primary-200">
                  Part B (sketching, {data.sketchMarks} marks) isn&rsquo;t in this timed test. Do it
                  any time in the{" "}
                  <button
                    type="button"
                    onClick={() => choosePart("b")}
                    className="font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    Part B tab
                  </button>
                  : upload, evaluate yourself and get expert and classmate ratings.
                </p>
              ) : null}
            </Card>

            <ShareTestCard quizId={id} title={data.title} />

            <Card density="compact" className="flex items-start gap-3">
              <IconBadge icon={Info} tone="primary" />
              <div>
                <p className="text-sm font-medium text-neutral-800 dark:text-white/90">
                  Before you start
                </p>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                  {rules.map((r) => (
                    <li key={r} className="flex items-start gap-2">
                      <CheckCircle2
                        size={14}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-success-600"
                      />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

export default function PracticeTestPage() {
  return (
    <RequireAuth>
      <TestContent />
    </RequireAuth>
  );
}
