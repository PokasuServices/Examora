"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BarChart3,
  Brush,
  ChevronDown,
  Clock,
  ListChecks,
  Medal,
  Target,
  Trophy,
  X,
} from "lucide-react";
import type { AnswerMethod, AttemptAnalysis, LeaderboardEntry, TopicInsight } from "@examora/types";
import { Button, cn } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { MyAnswers } from "@/components/quiz/my-answers";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { TopicPerformanceChart } from "@/components/student/topic-performance-chart";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { stagger, ToneCard, ToneIcon, toneClasses, type Tone } from "@/components/ui/tone-card";
import { useQuizApi } from "@/lib/quiz-api";
import { formatDuration, METHOD_LABEL, useStudentApi } from "@/lib/student-api";

/** Fixed categorical order for answer methods (identity colours, never reassigned). */
const METHOD_COLOR: Record<AnswerMethod | "SKIPPED", string> = {
  KNOWLEDGE: "bg-primary-600",
  ELIMINATION: "bg-amber-500",
  GUESS: "bg-rose-500",
  SKIPPED: "bg-neutral-300 dark:bg-neutral-600",
};
const METHODS: AnswerMethod[] = ["KNOWLEDGE", "ELIMINATION", "GUESS"];

type Tab = "anatomy" | "answers";
type JumpTo = (questionIndex: number) => void;

function StatTile({
  icon,
  label,
  value,
  hint,
  tone,
  index,
}: {
  icon: typeof Target;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone: Tone;
  index: number;
}) {
  return (
    <ToneCard tone={tone} index={index} className="flex items-start gap-3 p-4">
      <ToneIcon tone={tone} icon={icon} />
      <div className="min-w-0">
        <p
          className={cn(
            "text-xs font-medium uppercase tracking-wide opacity-80",
            toneClasses(tone).text,
          )}
        >
          {label}
        </p>
        <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
          {value}
        </p>
        {hint ? <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p> : null}
      </div>
    </ToneCard>
  );
}

/** One numbered group of the report ("1 Your true score", …). */
const SET_BADGE: Record<Tone, string> = {
  indigo: "bg-indigo-600",
  violet: "bg-violet-600",
  cyan: "bg-cyan-600",
  emerald: "bg-emerald-600",
  amber: "bg-amber-500",
  rose: "bg-rose-600",
  slate: "bg-neutral-600",
};

const SET_WASH: Record<Tone, string> = {
  indigo: "from-indigo-50 dark:from-indigo-500/10",
  violet: "from-violet-50 dark:from-violet-500/10",
  cyan: "from-cyan-50 dark:from-cyan-500/10",
  emerald: "from-emerald-50 dark:from-emerald-500/10",
  amber: "from-amber-50 dark:from-amber-500/10",
  rose: "from-rose-50 dark:from-rose-500/10",
  slate: "from-neutral-50 dark:from-white/[0.03]",
};

function ReportSet({
  number,
  title,
  subtitle,
  tone,
  children,
}: {
  number: number;
  title: string;
  subtitle: string;
  tone: Tone;
  children: React.ReactNode;
}) {
  const headingId = React.useId();
  return (
    <section
      aria-labelledby={headingId}
      className="motion-safe:animate-fade-up"
      style={stagger(number - 1, 90)}
    >
      <Card className="overflow-hidden p-0">
        <header
          className={cn(
            "relative flex items-start gap-3 border-b border-neutral-200 bg-gradient-to-r to-transparent px-6 py-4 dark:border-neutral-800",
            SET_WASH[tone],
          )}
        >
          <span
            aria-hidden="true"
            className={cn("absolute inset-y-0 left-0 w-1", SET_BADGE[tone])}
          />
          <span
            aria-hidden="true"
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white shadow-sm",
              SET_BADGE[tone],
            )}
          >
            {number}
          </span>
          <div>
            <h2
              id={headingId}
              className="text-base font-semibold text-neutral-800 dark:text-white/90"
            >
              {title}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>
          </div>
        </header>
        <div className="flex flex-col gap-8 p-6">{children}</div>
      </Card>
    </section>
  );
}

function BlockTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-medium text-neutral-800 dark:text-white/90">{children}</h3>
      {hint ? <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p> : null}
    </div>
  );
}

function MethodsBlock({ a, onSeeAll }: { a: AttemptAnalysis; onSeeAll: () => void }) {
  const total = METHODS.reduce((s, m) => s + a.methods[m].attempted, 0) + a.unattempted;
  const segments = [
    ...METHODS.map((m) => ({ key: m, label: METHOD_LABEL[m], count: a.methods[m].attempted })),
    { key: "SKIPPED" as const, label: "Not answered", count: a.unattempted },
  ].filter((s) => s.count > 0);
  return (
    <div>
      <BlockTitle
        hint={`Your true score counts guesses as wrong: ${a.trueScore} instead of ${a.obtainedMarks}.`}
      >
        How you answered
      </BlockTitle>
      {total > 0 ? (
        <div
          className="flex h-3 w-full origin-left overflow-hidden rounded-full motion-safe:animate-grow-x"
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
        <caption className="sr-only">Accuracy by answer method</caption>
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
      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={onSeeAll}>
          <ListChecks size={16} aria-hidden="true" /> See all questions
        </Button>
      </div>
    </div>
  );
}

function SubjectsBlock({ a }: { a: AttemptAnalysis }) {
  return (
    <div>
      <BlockTitle hint="Questions answered correctly in each subject.">By subject</BlockTitle>
      <ul className="flex flex-col gap-3">
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
                className="block h-full origin-left rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 motion-safe:animate-grow-x"
                style={{ width: `${s.percent}%` }}
              />
            </span>
            <span className="text-right tabular-nums text-neutral-600 dark:text-neutral-400">
              {s.correct}/{s.total}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionsBlock({ a }: { a: AttemptAnalysis }) {
  if (a.sections.length <= 1) return null;
  return (
    <div>
      <BlockTitle>By section</BlockTitle>
      <div className="overflow-x-auto">
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
    </div>
  );
}

/** "Knew it 1/4 · Ruled out options 0/3 · Guessed 1/3" (correct / answered). */
function MethodSplit({ t }: { t: TopicInsight }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
      {METHODS.map((m) => (
        <li key={m} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-sm ${METHOD_COLOR[m]}`} aria-hidden="true" />
          {METHOD_LABEL[m]}{" "}
          <span className="tabular-nums">
            {t.byMethod[m].correct}/{t.byMethod[m].answered}
          </span>
        </li>
      ))}
    </ul>
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
  const cardTone: Tone = tone === "danger" ? "rose" : tone === "warning" ? "amber" : "emerald";
  return (
    <div>
      <BlockTitle hint={hint}>{title}</BlockTitle>
      {items.length === 0 ? (
        <p className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-500 dark:bg-white/[0.03] dark:text-neutral-400">
          No topics here in this attempt.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((t, i) => (
            <li key={t.topicId}>
              <ToneCard tone={cardTone} index={i} className="p-3.5">
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
                <MethodSplit t={t} />
                {t.gain > 0 ? (
                  <p
                    className={cn(
                      "mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                      toneClasses(cardTone).soft,
                      toneClasses(cardTone).text,
                    )}
                  >
                    Up to +{t.gain} marks to gain
                  </p>
                ) : null}
              </ToneCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A topic in the attempt-order lists; opens to show its questions. */
function OrderRow({
  t,
  onJump,
  tone,
  rank,
}: {
  t: TopicInsight;
  onJump: JumpTo;
  tone: Tone;
  rank: number;
}) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  return (
    <li
      className={cn("rounded-lg motion-safe:animate-fade-up", toneClasses(tone).soft)}
      style={stagger(rank)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white",
              SET_BADGE[tone],
            )}
          >
            {rank + 1}
          </span>
          <span className="truncate font-medium text-neutral-700 dark:text-neutral-200">
            {t.topicTitle}
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs tabular-nums text-neutral-500">
          {t.trueScore} marks · {formatDuration(t.timeSeconds)}
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={cn("transition-transform", open && "rotate-180")}
          />
        </span>
      </button>
      {open ? (
        <div id={panelId} className="flex flex-wrap items-center gap-1.5 px-3 pb-3">
          <span className="text-xs text-neutral-500">Questions:</span>
          {t.questionNumbers.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onJump(n - 1)}
              aria-label={`Open question ${n} in My answers`}
              className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-primary-700 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-primary-300"
            >
              Q{n}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function OrderList({
  title,
  hint,
  items,
  onJump,
  tone,
}: {
  title: string;
  hint: string;
  items: TopicInsight[];
  onJump: JumpTo;
  tone: Tone;
}) {
  return (
    <div>
      <BlockTitle hint={hint}>{title}</BlockTitle>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-400">—</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {items.map((t, i) => (
            <OrderRow key={t.topicId} t={t} onJump={onJump} tone={tone} rank={i} />
          ))}
        </ol>
      )}
    </div>
  );
}

function TimeBlock({ a }: { a: AttemptAnalysis }) {
  return (
    <div>
      <BlockTitle hint="Where your time went.">Time</BlockTitle>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {(
          [
            ["Well spent", "Correct in 90 s or less", a.timeUsage.wiselyUsed, "emerald"],
            ["Over spent", "Correct, but over 90 s", a.timeUsage.overSpent, "amber"],
            ["Lost", "On wrong answers", a.timeUsage.lost, "rose"],
            ["Wasted", "Opened but not answered", a.timeUsage.wasted, "slate"],
          ] as const
        ).map(([label, hint, v, tone], i) => (
          <ToneCard key={label} tone={tone} index={i} className="px-3 py-2.5">
            <dt className={cn("text-xs font-medium", toneClasses(tone).text)}>{label}</dt>
            <dd className="font-semibold tabular-nums text-neutral-800 dark:text-white/90">
              {formatDuration(v.seconds)}
            </dd>
            <dd className="text-xs text-neutral-500">
              {v.questions} question{v.questions === 1 ? "" : "s"} · {hint}
            </dd>
          </ToneCard>
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

function ScoreAnatomy({ a, onJump }: { a: AttemptAnalysis; onJump: JumpTo }) {
  const pct = a.totalMarks > 0 ? Math.round((a.obtainedMarks / a.totalMarks) * 100) : 0;
  const allTopics = [...a.weakTopics, ...a.opportunityTopics, ...a.strongTopics];
  const guessNote = "Guesses count as wrong here.";

  return (
    <div className="flex flex-col gap-6">
      {a.partBCount > 0 ? (
        <Card density="compact" className="flex flex-wrap items-center gap-3">
          <Brush size={18} aria-hidden="true" className="shrink-0 text-primary-600" />
          <p className="min-w-0 flex-1 text-sm text-neutral-700 dark:text-neutral-300">
            This report is Part A only. Part B (sketching, {a.partBCount}{" "}
            {a.partBCount === 1 ? "question" : "questions"}) has its own report with your
            self-evaluation, expert and classmate ratings.
          </p>
          <Link
            href={`/practice/tests/${a.quizId}?part=b`}
            className="inline-flex h-9 items-center rounded-md border border-primary-300 px-3 text-sm font-medium text-primary-700 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-primary-500/40 dark:text-primary-300 dark:hover:bg-primary-500/10"
          >
            Open Part B
          </Link>
        </Card>
      ) : null}

      <ReportSet
        number={1}
        tone="indigo"
        title="Your true score"
        subtitle="What you scored, and how much of it you really knew."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            tone="indigo"
            index={0}
            icon={Target}
            label="Score"
            value={`${a.obtainedMarks} / ${a.totalMarks}`}
            hint={`${pct}%`}
          />
          <StatTile
            tone="emerald"
            index={1}
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
            tone="amber"
            index={2}
            icon={Trophy}
            label="Rank (first attempts)"
            value={a.rank ? `${a.rank} / ${a.candidates}` : "—"}
            hint={
              a.percentile !== null
                ? `Ahead of ${a.percentile}% of others`
                : "You're the first to finish"
            }
          />
          <StatTile
            tone="cyan"
            index={3}
            icon={Clock}
            label="Time taken"
            value={formatDuration(a.totalTimeSeconds)}
          />
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          <MethodsBlock a={a} onSeeAll={() => onJump(0)} />
          <SubjectsBlock a={a} />
        </div>
        <SectionsBlock a={a} />
      </ReportSet>

      <ReportSet
        number={2}
        tone="violet"
        title="Preparation strategy"
        subtitle="Which topics to revise before your next attempt."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <TopicList
            title="Danger topics"
            hint={`Answers you were sure of went wrong. ${guessNote}`}
            items={a.weakTopics}
            tone="danger"
          />
          <TopicList
            title="Scoring opportunities"
            hint={`Skipped, guessed or part marks. ${guessNote}`}
            items={a.opportunityTopics}
            tone="warning"
          />
          <TopicList
            title="Mastered"
            hint={`Full marks without guessing. ${guessNote}`}
            items={a.strongTopics}
            tone="success"
          />
        </div>
        <div>
          <BlockTitle>Topic performance</BlockTitle>
          <TopicPerformanceChart topics={allTopics} />
        </div>
      </ReportSet>

      <ReportSet
        number={3}
        tone="cyan"
        title="Attempt strategy"
        subtitle="The order to answer in next time, and where your time went."
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="grid gap-6 sm:grid-cols-2">
            <OrderList
              title="Answer these first"
              hint="Most marks per minute. Open one to see its questions."
              items={a.attemptOrder.first}
              onJump={onJump}
              tone="emerald"
            />
            <OrderList
              title="Answer these last"
              hint={`Fewest marks per minute. ${guessNote}`}
              items={a.attemptOrder.last}
              onJump={onJump}
              tone="amber"
            />
          </div>
          <TimeBlock a={a} />
        </div>
      </ReportSet>
    </div>
  );
}

function readUrl(): { tab: Tab; question: number } {
  const params = new URLSearchParams(window.location.search);
  const q = Number(params.get("q"));
  return {
    tab: params.get("tab") === "answers" ? "answers" : "anatomy",
    question: Number.isInteger(q) && q > 0 ? q - 1 : 0,
  };
}

function ReportContent() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const api = useStudentApi();
  const quizApi = useQuizApi();
  const {
    data: a,
    errorStatus,
    loading,
    reload,
  } = useLoad(() => api.analysis(attemptId), attemptId);
  const [tab, setTab] = React.useState<Tab>("anatomy");
  const [question, setQuestion] = React.useState(0);
  const [answersOpened, setAnswersOpened] = React.useState(false);
  const review = useLoad(
    () => quizApi.getReview(attemptId),
    answersOpened ? `review-${attemptId}` : null,
  );
  const [board, setBoard] = React.useState<LeaderboardEntry[] | null>(null);
  const [boardOpen, setBoardOpen] = React.useState(false);
  const tabsId = React.useId();

  React.useEffect(() => {
    const fromUrl = readUrl();
    setTab(fromUrl.tab);
    setQuestion(fromUrl.question);
    if (fromUrl.tab === "answers") setAnswersOpened(true);
  }, []);

  const writeUrl = React.useCallback((next: Tab, q: number) => {
    const params = new URLSearchParams(window.location.search);
    if (next === "answers") {
      params.set("tab", "answers");
      params.set("q", String(q + 1));
    } else {
      params.delete("tab");
      params.delete("q");
    }
    const rest = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
  }, []);

  function chooseTab(next: Tab) {
    setTab(next);
    if (next === "answers") setAnswersOpened(true);
    writeUrl(next, question);
  }

  const jumpTo = React.useCallback(
    (q: number) => {
      setQuestion(q);
      setTab("answers");
      setAnswersOpened(true);
      writeUrl("answers", q);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [writeUrl],
  );

  async function openBoard() {
    setBoardOpen(true);
    if (!board) setBoard(await api.leaderboard(attemptId).catch(() => []));
  }

  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !a) return <LoadingPanel />;

  const title = a.topic
    ? `Quiz report: ${a.quizTitle}`
    : a.partBCount > 0
      ? `Part A report: ${a.quizTitle}`
      : `Report: ${a.quizTitle}`;
  const trail = a.topic
    ? [
        { label: a.topic.courseTitle ?? "Learn", href: "/learn" },
        { label: a.topic.title, href: `/learn/topics/${a.topic.id}` },
      ]
    : a.isPractice
      ? [
          { label: "Practice", href: "/practice" },
          ...(a.partBCount > 0
            ? [{ label: a.quizTitle, href: `/practice/tests/${a.quizId}` }]
            : []),
        ]
      : [{ label: "Quizzes", href: "/quizzes" }];

  const tabs: { key: Tab; label: string; icon: typeof Target }[] = [
    { key: "anatomy", label: "Score anatomy", icon: BarChart3 },
    { key: "answers", label: "My answers", icon: ListChecks },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title={title}
        trail={trail}
        actions={
          <Button variant="outline" onClick={() => void openBoard()}>
            <Trophy size={16} aria-hidden="true" /> Leaderboard
          </Button>
        }
      />

      <div
        role="tablist"
        aria-label="Report views"
        className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800"
      >
        {tabs.map((t) => {
          const selected = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              id={`${tabsId}-${t.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${tabsId}-panel`}
              onClick={() => chooseTab(t.key)}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                selected
                  ? "border-primary-600 text-primary-700 dark:text-primary-300"
                  : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white/90",
              )}
            >
              <Icon size={16} aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${tab}`}>
        {tab === "anatomy" ? (
          <ScoreAnatomy a={a} onJump={jumpTo} />
        ) : review.errorStatus !== null ? (
          <ErrorPanel status={review.errorStatus} onRetry={review.reload} />
        ) : !review.data ? (
          <LoadingPanel />
        ) : (
          <MyAnswers
            attemptId={attemptId}
            analysis={a}
            review={review.data}
            index={question}
            onIndexChange={(q) => {
              setQuestion(q);
              writeUrl("answers", q);
            }}
          />
        )}
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
