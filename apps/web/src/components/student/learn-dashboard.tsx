"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleDashed,
  FileQuestion,
  Layers,
  Loader,
  PauseCircle,
  Repeat2,
  Star,
  Zap,
} from "lucide-react";
import type {
  LearnDashboard,
  LearnTopicRow,
  LearnTopicStatus,
  TopicMarkValue,
} from "@examora/types";
import { cn } from "@examora/ui";
import { stagger, ToneCard, ToneIcon, toneClasses, type Tone } from "@/components/ui/tone-card";
import { useLearnApi } from "@/lib/learn-api";

const STATUS: Record<LearnTopicStatus, { label: string; tone: Tone; icon: typeof Star }> = {
  COMPLETED: { label: "Completed", tone: "emerald", icon: CheckCircle2 },
  IN_PROGRESS: { label: "In progress", tone: "amber", icon: Loader },
  NOT_STARTED: { label: "Not started", tone: "slate", icon: CircleDashed },
  EMPTY: { label: "Coming soon", tone: "slate", icon: CircleDashed },
};

type Filter = "all" | "favourite" | "inProgress" | "notStarted" | "completed" | "onHold" | "shared";

const FILTERS: {
  key: Filter;
  label: string;
  icon: typeof Star;
  test: (t: LearnTopicRow) => boolean;
}[] = [
  { key: "all", label: "All topics", icon: Layers, test: () => true },
  { key: "favourite", label: "Favourites", icon: Star, test: (t) => t.favourite },
  {
    key: "inProgress",
    label: "In progress",
    icon: Loader,
    test: (t) => t.status === "IN_PROGRESS",
  },
  {
    key: "notStarted",
    label: "Not started",
    icon: CircleDashed,
    test: (t) => t.status === "NOT_STARTED",
  },
  {
    key: "completed",
    label: "Completed",
    icon: CheckCircle2,
    test: (t) => t.status === "COMPLETED",
  },
  { key: "onHold", label: "On hold", icon: PauseCircle, test: (t) => t.onHold },
  {
    key: "shared",
    label: "Shared across exams",
    icon: Repeat2,
    test: (t) => t.examTags.length >= 2,
  },
];

/** Star and pause toggles for one topic (also used on the topic page). */
export function TopicMarkButtons({
  topicId,
  value,
  onChange,
  size = "sm",
}: {
  topicId: string;
  value: TopicMarkValue;
  onChange: (v: TopicMarkValue) => void;
  size?: "sm" | "md";
}) {
  const api = useLearnApi();
  const [busy, setBusy] = React.useState(false);

  async function toggle(key: keyof TopicMarkValue) {
    const previous = value;
    const next = { ...value, [key]: !value[key] };
    onChange(next);
    setBusy(true);
    try {
      onChange(await api.markTopic(topicId, { [key]: next[key] }));
    } catch {
      onChange(previous);
    } finally {
      setBusy(false);
    }
  }

  const base =
    "inline-flex items-center gap-1 rounded-full font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60 motion-reduce:transition-none";
  const pad = size === "md" ? "px-3 py-1.5 text-sm" : "p-1.5";
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        aria-pressed={value.favourite}
        aria-label={value.favourite ? "Remove from favourites" : "Mark as favourite"}
        title={value.favourite ? "Favourite" : "Mark as favourite"}
        disabled={busy}
        onClick={() => void toggle("favourite")}
        className={cn(
          base,
          pad,
          value.favourite
            ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"
            : "text-neutral-400 hover:bg-amber-50 hover:text-amber-500 dark:hover:bg-amber-500/10",
        )}
      >
        <Star
          size={size === "md" ? 16 : 15}
          className={value.favourite ? "fill-current" : ""}
          aria-hidden="true"
        />
        {size === "md" ? (value.favourite ? "Favourite" : "Mark favourite") : null}
      </button>
      <button
        type="button"
        aria-pressed={value.onHold}
        aria-label={value.onHold ? "Take off hold" : "Put on hold"}
        title={value.onHold ? "On hold" : "Put on hold"}
        disabled={busy}
        onClick={() => void toggle("onHold")}
        className={cn(
          base,
          pad,
          value.onHold
            ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
            : "text-neutral-400 hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-500/10",
        )}
      >
        <PauseCircle size={size === "md" ? 16 : 15} aria-hidden="true" />
        {size === "md" ? (value.onHold ? "On hold" : "Put on hold") : null}
      </button>
    </span>
  );
}

export function ExamTagChips({ tags, className }: { tags: string[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {tags.length >= 2 ? <Repeat2 size={12} aria-hidden="true" className="text-cyan-600" /> : null}
      {tags.map((t) => (
        <span
          key={t}
          className="rounded-full bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200"
        >
          {t}
        </span>
      ))}
    </span>
  );
}

function ContinueCard({ d, courseTitle }: { d: LearnDashboard; courseTitle: string }) {
  const c = d.continueWith;
  return (
    <ToneCard tone="indigo" className="p-5">
      <div className="flex flex-wrap items-center gap-4">
        <ToneIcon tone="indigo" icon={c?.kind === "quiz" ? FileQuestion : BookOpen} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-700/80 dark:text-indigo-300/80">
            {c ? "Continue where you left off" : "Your progress"}
          </p>
          {c ? (
            <>
              <p className="truncate text-lg font-semibold text-neutral-900 dark:text-white">
                {c.title}
              </p>
              <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                {c.subjectTitle} › {c.topicTitle}
              </p>
            </>
          ) : (
            <p className="text-lg font-semibold text-neutral-900 dark:text-white">
              {d.counts.completed === d.counts.topics && d.counts.topics > 0
                ? `You've finished every topic in ${courseTitle}!`
                : "Everything left is on hold. Take a topic off hold to continue."}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
            <Zap size={12} aria-hidden="true" /> {d.xpThisWeek} XP this week
          </span>
          {c ? (
            <Link
              href={c.kind === "lesson" ? `/learn/lessons/${c.id}` : `/learn/quizzes/${c.id}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
            >
              Continue <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
      <div className="mt-4">
        <div
          className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-inset ring-neutral-200 dark:bg-white/10 dark:ring-white/10"
          role="progressbar"
          aria-label={`${d.percent}% of ${courseTitle} done`}
          aria-valuenow={d.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full origin-left rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 motion-safe:animate-grow-x"
            style={{ width: `${d.percent}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          <strong className="text-indigo-700 dark:text-indigo-300">{d.percent}%</strong> of{" "}
          {courseTitle} done
        </p>
      </div>
    </ToneCard>
  );
}

function StatCards({ d, onFilter }: { d: LearnDashboard; onFilter: (f: Filter) => void }) {
  const c = d.counts;
  const cards: {
    tone: Tone;
    icon: typeof Star;
    label: string;
    value: string;
    hint: string;
    filter: Filter;
  }[] = [
    {
      tone: "indigo",
      icon: Layers,
      label: "Subjects",
      value: String(c.subjects),
      hint: `${c.topics} topics in all`,
      filter: "all",
    },
    {
      tone: "emerald",
      icon: CheckCircle2,
      label: "Completed",
      value: `${c.completed}`,
      hint: `of ${c.topics} topics`,
      filter: "completed",
    },
    {
      tone: "amber",
      icon: Loader,
      label: "In progress",
      value: String(c.inProgress),
      hint: `${c.notStarted} not started yet`,
      filter: "inProgress",
    },
    {
      tone: "cyan",
      icon: Repeat2,
      label: "Shared topics",
      value: String(c.shared),
      hint: "Count for more than one exam",
      filter: "shared",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((k, i) => (
        <ToneCard key={k.label} tone={k.tone} index={i} interactive className="p-0">
          <button
            type="button"
            onClick={() => onFilter(k.filter)}
            className="flex w-full items-start gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <ToneIcon tone={k.tone} icon={k.icon} />
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-xs font-medium uppercase tracking-wide",
                  toneClasses(k.tone).text,
                )}
              >
                {k.label}
              </span>
              <span className="block text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
                {k.value}
              </span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">{k.hint}</span>
            </span>
          </button>
        </ToneCard>
      ))}
    </div>
  );
}

function TopicBoard({
  topics,
  filter,
  onFilter,
  onMark,
}: {
  topics: LearnTopicRow[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  onMark: (id: string, v: TopicMarkValue) => void;
}) {
  const active = FILTERS.find((f) => f.key === filter)!;
  const shown = topics.filter(active.test);
  return (
    <section
      aria-labelledby="my-topics"
      className="rounded-card border border-neutral-200 bg-white p-5 shadow-soft motion-safe:animate-fade-up dark:border-neutral-800 dark:bg-neutral-900"
      style={stagger(4)}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ToneIcon tone="violet" icon={Star} size="sm" />
          <div>
            <h2
              id="my-topics"
              className="text-base font-semibold text-neutral-800 dark:text-white/90"
            >
              My topics
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Star the important ones, put some on hold, and see which count for several exams.
            </p>
          </div>
        </div>
      </div>
      <div role="tablist" aria-label="Filter topics" className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const n = topics.filter(f.test).length;
          const selected = f.key === filter;
          const Icon = f.icon;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                selected
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300",
              )}
            >
              <Icon size={12} aria-hidden="true" /> {f.label}
              <span className="tabular-nums opacity-75">{n}</span>
            </button>
          );
        })}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-md bg-neutral-50 px-3 py-4 text-center text-sm text-neutral-500 dark:bg-white/[0.03]">
          {filter === "favourite"
            ? "No favourites yet. Tap the ☆ on a topic to keep it handy."
            : filter === "onHold"
              ? "Nothing on hold."
              : filter === "shared"
                ? "No topics are tagged for more than one exam yet."
                : "No topics here."}
        </p>
      ) : (
        <ul key={filter} className="grid gap-2 md:grid-cols-2">
          {shown.map((t, i) => {
            const s = STATUS[t.status];
            const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0;
            return (
              <li
                key={t.id}
                className={cn(
                  "group flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 transition hover:border-indigo-200 hover:shadow-soft-hover motion-safe:animate-fade-up motion-reduce:transition-none dark:border-neutral-800 dark:bg-neutral-900",
                  t.onHold && "opacity-70",
                )}
                style={stagger(Math.min(i, 12), 30)}
              >
                <span
                  aria-hidden="true"
                  className={cn("h-9 w-1 shrink-0 rounded-full", toneClasses(s.tone).line)}
                />
                <Link
                  href={`/learn/topics/${t.id}`}
                  className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <span className="block truncate text-sm font-medium text-neutral-800 group-hover:text-indigo-700 dark:text-white/90">
                    {t.title}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500">
                    <span>{t.subjectTitle}</span>
                    <span className={cn("font-medium", toneClasses(s.tone).text)}>
                      {s.label}
                      {t.status === "IN_PROGRESS" ? ` · ${pct}%` : ""}
                    </span>
                    {t.onHold ? <span className="font-medium text-violet-600">On hold</span> : null}
                    <ExamTagChips tags={t.examTags} />
                  </span>
                </Link>
                <TopicMarkButtons
                  topicId={t.id}
                  value={{ favourite: t.favourite, onHold: t.onHold }}
                  onChange={(v) => onMark(t.id, v)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The summary at the top of the Learn tab. Topic marks update in place. */
export function LearnDashboardPanel({
  dashboard,
  courseTitle,
}: {
  dashboard: LearnDashboard;
  courseTitle: string;
}) {
  const [topics, setTopics] = React.useState(dashboard.topics);
  const [filter, setFilter] = React.useState<Filter>("all");
  const boardRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => setTopics(dashboard.topics), [dashboard.topics]);

  const d: LearnDashboard = {
    ...dashboard,
    topics,
    counts: {
      ...dashboard.counts,
      favourite: topics.filter((t) => t.favourite).length,
      onHold: topics.filter((t) => t.onHold).length,
    },
  };

  function chooseFilter(f: Filter) {
    setFilter(f);
    boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-6">
      <ContinueCard d={d} courseTitle={courseTitle} />
      <StatCards d={d} onFilter={chooseFilter} />
      <div ref={boardRef} className="scroll-mt-20">
        <TopicBoard
          topics={topics}
          filter={filter}
          onFilter={setFilter}
          onMark={(id, v) => setTopics((all) => all.map((t) => (t.id === id ? { ...t, ...v } : t)))}
        />
      </div>
    </div>
  );
}
