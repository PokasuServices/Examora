"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Clock, Medal, Target, Trophy, X } from "lucide-react";
import type { AnswerMethod, AttemptAnalysis, LeaderboardEntry, TopicInsight } from "@examora/types";
import { Button } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { IconBadge } from "@/components/ui/icon-badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatDuration, METHOD_LABEL, useStudentApi } from "@/lib/student-api";

/** Fixed categorical order for answer methods (identity colours, never reassigned). */
const METHOD_COLOR: Record<AnswerMethod | "SKIPPED", string> = {
  KNOWLEDGE: "bg-primary-600",
  ELIMINATION: "bg-amber-500",
  GUESS: "bg-rose-500",
  SKIPPED: "bg-neutral-300 dark:bg-neutral-600",
};
const METHODS: AnswerMethod[] = ["KNOWLEDGE", "ELIMINATION", "GUESS"];

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: typeof Target;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <Card density="compact" className="flex items-start gap-3">
      <IconBadge icon={icon} tone="primary" />
      <div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-neutral-800 dark:text-white/90">
          {value}
        </p>
        {hint ? <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p> : null}
      </div>
    </Card>
  );
}

function MethodsCard({ a }: { a: AttemptAnalysis }) {
  const total = METHODS.reduce((s, m) => s + a.methods[m].attempted, 0) + a.unattempted;
  const segments = [
    ...METHODS.map((m) => ({ key: m, label: METHOD_LABEL[m], count: a.methods[m].attempted })),
    { key: "SKIPPED" as const, label: "Not answered", count: a.unattempted },
  ].filter((s) => s.count > 0);
  return (
    <Card>
      <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">
        How you answered
      </h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Your true score counts guesses as wrong:{" "}
        <strong className="text-neutral-800 dark:text-white/90">{a.trueScore}</strong> instead of{" "}
        {a.obtainedMarks}.
      </p>
      {total > 0 ? (
        <div
          className="mt-4 flex h-3 w-full overflow-hidden rounded-full"
          role="img"
          aria-label="Share of questions by how they were answered"
        >
          {segments.map((s) => (
            <span
              key={s.key}
              className={`${METHOD_COLOR[s.key]} h-full border-r-2 border-white last:border-r-0 dark:border-neutral-900`}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${s.label}: ${s.count}`}
            />
          ))}
        </div>
      ) : null}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${METHOD_COLOR[s.key]}`} aria-hidden="true" />
            {s.label} ({s.count})
          </li>
        ))}
      </ul>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-neutral-500 dark:text-neutral-400">
            <th scope="col" className="py-1.5 font-medium">
              Method
            </th>
            <th scope="col" className="py-1.5 text-right font-medium">
              Answered
            </th>
            <th scope="col" className="py-1.5 text-right font-medium">
              Correct
            </th>
            <th scope="col" className="py-1.5 text-right font-medium">
              Wrong
            </th>
            <th scope="col" className="py-1.5 text-right font-medium">
              Accuracy
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {METHODS.map((m) => {
            const s = a.methods[m];
            return (
              <tr key={m}>
                <th
                  scope="row"
                  className="py-2 text-left font-normal text-neutral-700 dark:text-neutral-300"
                >
                  {METHOD_LABEL[m]}
                </th>
                <td className="py-2 text-right tabular-nums">{s.attempted}</td>
                <td className="py-2 text-right tabular-nums">{s.correct}</td>
                <td className="py-2 text-right tabular-nums">{s.wrong}</td>
                <td className="py-2 text-right tabular-nums">
                  {s.attempted === 0 ? "—" : `${Math.round((s.correct / s.attempted) * 100)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function TopicList({
  title,
  hint,
  items,
  tone,
}: {
  title: string;
  hint: string;
  items: TopicInsight[];
  tone: "danger" | "warning" | "success";
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-neutral-800 dark:text-white/90">{title}</h3>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">None in this attempt.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((t) => (
            <li
              key={t.topicId}
              className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
            >
              <div className="flex items-start justify-between gap-2">
                <span>
                  <span className="block text-sm font-medium text-neutral-800 dark:text-white/90">
                    {t.topicTitle}
                  </span>
                  <span className="block text-xs text-neutral-500">{t.subjectTitle}</span>
                </span>
                <Chip tone={tone}>
                  {t.correct}/{t.total}
                </Chip>
              </div>
              <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400">{t.reason}</p>
              {t.gain > 0 ? (
                <p className="mt-1 text-xs font-medium text-primary-700 dark:text-primary-300">
                  Up to +{t.gain} marks to gain
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderList({ title, items }: { title: string; items: TopicInsight[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-neutral-800 dark:text-white/90">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">—</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-1.5 text-sm">
          {items.map((t) => (
            <li
              key={t.topicId}
              className="flex justify-between gap-3 rounded-md bg-neutral-50 px-3 py-2 dark:bg-white/[0.03]"
            >
              <span className="text-neutral-700 dark:text-neutral-300">{t.topicTitle}</span>
              <span className="text-xs tabular-nums text-neutral-500">
                {t.trueScore} marks · {formatDuration(t.timeSeconds)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function LeaderboardDialog({
  entries,
  onClose,
}: {
  entries: LeaderboardEntry[] | null;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lb-title"
        className="relative w-full max-w-md rounded-card border border-neutral-200 bg-white p-6 shadow-soft-hover dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between">
          <h2 id="lb-title" className="text-lg font-medium text-neutral-800 dark:text-white/90">
            Leaderboard
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-xs text-neutral-500">First attempts, ranked by marks then time.</p>
        {entries === null ? (
          <p className="mt-4 text-sm text-neutral-500">Loading…</p>
        ) : (
          <ol className="mt-4 flex flex-col gap-1.5">
            {entries.map((e) => (
              <li
                key={`${e.rank}-${e.name}`}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${e.isMe ? "bg-primary-50 font-medium dark:bg-primary-500/15" : "bg-neutral-50 dark:bg-white/[0.03]"}`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right tabular-nums text-neutral-500">{e.rank}</span>
                  {e.name}
                  {e.isMe ? <Chip tone="primary">You</Chip> : null}
                </span>
                <span className="tabular-nums text-neutral-600 dark:text-neutral-400">
                  {e.obtainedMarks}/{e.totalMarks} · {formatDuration(e.timeSeconds)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function ReportContent() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const api = useStudentApi();
  const {
    data: a,
    errorStatus,
    loading,
    reload,
  } = useLoad(() => api.analysis(attemptId), attemptId);
  const [board, setBoard] = React.useState<LeaderboardEntry[] | null>(null);
  const [boardOpen, setBoardOpen] = React.useState(false);

  async function openBoard() {
    setBoardOpen(true);
    if (!board) setBoard(await api.leaderboard(attemptId).catch(() => []));
  }

  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !a) return <LoadingPanel />;

  const pct = a.totalMarks > 0 ? Math.round((a.obtainedMarks / a.totalMarks) * 100) : 0;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={`Report: ${a.quizTitle}`}
        trail={[{ label: "Practice", href: "/practice" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void openBoard()}>
              <Trophy size={16} aria-hidden="true" /> Leaderboard
            </Button>
            <Link
              href={`/quizzes/attempts/${attemptId}/review`}
              className="inline-flex h-10 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700"
            >
              Review answers
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Target}
          label="Score"
          value={`${a.obtainedMarks} / ${a.totalMarks}`}
          hint={`${pct}%`}
        />
        <StatTile
          icon={Medal}
          label="True score"
          value={a.trueScore}
          hint={
            a.marksFromGuesses > 0
              ? `${a.marksFromGuesses} marks came from guesses`
              : "No marks from guesses"
          }
        />
        <StatTile
          icon={Trophy}
          label="Rank (first attempts)"
          value={a.rank ? `${a.rank} / ${a.candidates}` : "—"}
          hint={
            a.percentile !== null
              ? `Ahead of ${a.percentile}% of others`
              : "You're the first to finish"
          }
        />
        <StatTile icon={Clock} label="Time taken" value={formatDuration(a.totalTimeSeconds)} />
      </div>

      {a.sections.length > 1 ? (
        <Card>
          <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">By section</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs text-neutral-500 dark:text-neutral-400">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Section
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Score
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Correct
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Wrong
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Skipped
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Awaiting review
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {a.sections.map((sec) => (
                  <tr key={sec.sectionId}>
                    <th
                      scope="row"
                      className="py-2 pr-3 font-normal text-neutral-700 dark:text-neutral-300"
                    >
                      {sec.title}
                      <span className="block text-xs text-neutral-500">
                        {sec.questionCount} questions
                      </span>
                    </th>
                    <td className="py-2 pr-3 text-right font-medium tabular-nums text-neutral-800 dark:text-white/90">
                      {sec.obtained} / {sec.total}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{sec.correct}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{sec.wrong}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{sec.unattempted}</td>
                    <td className="py-2 text-right tabular-nums">{sec.pending || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <MethodsCard a={a} />
        <Card>
          <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">By subject</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {a.subjects.map((s) => (
              <li
                key={s.subjectId ?? s.title}
                className="grid grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-3 text-sm"
              >
                <span className="truncate text-neutral-700 dark:text-neutral-300" title={s.title}>
                  {s.title}
                </span>
                <span
                  className="h-2.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10"
                  role="img"
                  aria-label={`${s.title}: ${s.correct} of ${s.total} correct`}
                >
                  <span
                    className="block h-full rounded-full bg-primary-600"
                    style={{ width: `${s.percent}%` }}
                  />
                </span>
                <span className="text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                  {s.correct}/{s.total}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">Topics</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <TopicList
            title="Needs work"
            hint="Answers you were sure of went wrong"
            items={a.weakTopics}
            tone="danger"
          />
          <TopicList
            title="Room to improve"
            hint="Skipped, guessed or part marks"
            items={a.opportunityTopics}
            tone="warning"
          />
          <TopicList
            title="Strong"
            hint="Full marks without guessing"
            items={a.strongTopics}
            tone="success"
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">
            Attempt order for next time
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Based on marks earned per second spent.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <OrderList title="Tackle early" items={a.attemptOrder.first} />
            <OrderList title="Leave for later" items={a.attemptOrder.last} />
          </div>
        </Card>
        <Card>
          <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">Time</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {(
              [
                ["Well spent", "Correct in 90 s or less", a.timeUsage.wiselyUsed],
                ["Over spent", "Correct, but over 90 s", a.timeUsage.overSpent],
                ["Lost", "On wrong answers", a.timeUsage.lost],
                ["Wasted", "Opened but not answered", a.timeUsage.wasted],
              ] as const
            ).map(([label, hint, v]) => (
              <div
                key={label}
                className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800"
              >
                <dt className="text-xs text-neutral-500">{label}</dt>
                <dd className="font-semibold tabular-nums text-neutral-800 dark:text-white/90">
                  {formatDuration(v.seconds)}
                </dd>
                <dd className="text-xs text-neutral-500">
                  {v.questions} question{v.questions === 1 ? "" : "s"} · {hint}
                </dd>
              </div>
            ))}
          </dl>
          <table className="mt-4 w-full text-sm">
            <caption className="mb-2 text-left text-xs text-neutral-500">
              Accuracy by time spent on a question
            </caption>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {a.timeBuckets.map((b) => (
                <tr key={b.label}>
                  <th
                    scope="row"
                    className="py-1.5 text-left font-normal text-neutral-700 dark:text-neutral-300"
                  >
                    {b.label}
                  </th>
                  <td className="py-1.5 text-right tabular-nums">{b.questions} questions</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {b.accuracy === null ? "—" : `${b.accuracy}% correct`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {boardOpen ? <LeaderboardDialog entries={board} onClose={() => setBoardOpen(false)} /> : null}
    </main>
  );
}

export default function ResultPage() {
  return (
    <RequireAuth>
      <ReportContent />
    </RequireAuth>
  );
}
