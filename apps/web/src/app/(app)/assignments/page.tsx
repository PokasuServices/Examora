"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FilePen,
  Hourglass,
  MessageSquareWarning,
  Sparkles,
  Trophy,
} from "lucide-react";
import type {
  StudentAssignmentDashboard,
  StudentAssignmentItem,
  StudentAssignmentState,
} from "@examora/types";
import { cn } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { stagger, ToneCard, ToneIcon, toneClasses, type Tone } from "@/components/ui/tone-card";
import { useAssignmentApi } from "@/lib/assignment-api";

const DATE = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });
const fmt = (iso: string) => DATE.format(new Date(iso));

const STATE: Record<
  StudentAssignmentState,
  { label: string; tone: Tone; action: string; icon: typeof Clock }
> = {
  NOT_STARTED: { label: "Not started", tone: "slate", action: "Start", icon: ClipboardList },
  DRAFT: { label: "In progress", tone: "indigo", action: "Continue", icon: FilePen },
  WAITING: { label: "Waiting for review", tone: "cyan", action: "View", icon: Hourglass },
  NEEDS_CHANGES: {
    label: "Changes requested",
    tone: "violet",
    action: "Revise",
    icon: MessageSquareWarning,
  },
  REVIEWED: { label: "Reviewed", tone: "emerald", action: "See feedback", icon: CheckCircle2 },
};

type Filter = "all" | "todo" | "soon" | "overdue" | "submitted" | "reviewed" | "new";

const FILTERS: { key: Filter; label: string; test: (i: StudentAssignmentItem) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "new", label: "New", test: (i) => i.isNew },
  {
    key: "todo",
    label: "To do",
    test: (i) => i.state === "NOT_STARTED" || i.state === "DRAFT" || i.state === "NEEDS_CHANGES",
  },
  {
    key: "soon",
    label: "Due soon",
    test: (i) =>
      !i.overdue &&
      i.dueInDays !== null &&
      i.dueInDays <= 3 &&
      (i.state === "NOT_STARTED" || i.state === "DRAFT"),
  },
  { key: "overdue", label: "Overdue", test: (i) => i.overdue },
  { key: "submitted", label: "Submitted", test: (i) => i.state === "WAITING" },
  { key: "reviewed", label: "Reviewed", test: (i) => i.state === "REVIEWED" },
];

function dueText(i: StudentAssignmentItem): string | null {
  if (i.dueInDays === null || !i.deadline) return null;
  if (i.overdue) return `${-i.dueInDays} ${i.dueInDays === -1 ? "day" : "days"} late`;
  if (i.dueInDays < 0) return `Was due ${fmt(i.deadline)}`;
  if (i.dueInDays === 0) return "Due today";
  if (i.dueInDays === 1) return "Due tomorrow";
  return `Due in ${i.dueInDays} days`;
}

function hrefOf(i: StudentAssignmentItem): string {
  return (i.state === "WAITING" || i.state === "REVIEWED") && i.submissionId
    ? `/assignments/submission/${i.submissionId}`
    : `/assignments/${i.id}`;
}

// ----------------------------------------------------------------- alerts

function Alerts({ d, onFilter }: { d: StudentAssignmentDashboard; onFilter: (f: Filter) => void }) {
  const c = d.counts;
  const alerts: { show: boolean; tone: Tone; icon: typeof Clock; text: string; filter: Filter }[] =
    [
      {
        show: c.new > 0,
        tone: "indigo",
        icon: Sparkles,
        text: `${c.new} new ${c.new === 1 ? "assignment" : "assignments"} since your last visit`,
        filter: "new",
      },
      {
        show: c.needsChanges > 0,
        tone: "violet",
        icon: MessageSquareWarning,
        text: `Your reviewer asked for changes on ${c.needsChanges} ${c.needsChanges === 1 ? "assignment" : "assignments"}`,
        filter: "todo",
      },
      {
        show: c.dueSoon > 0,
        tone: "amber",
        icon: CalendarClock,
        text: `${c.dueSoon} due in the next 3 days`,
        filter: "soon",
      },
      {
        show: c.overdue > 0,
        tone: "rose",
        icon: AlertTriangle,
        text: `${c.overdue} past the deadline. You can still submit late`,
        filter: "overdue",
      },
    ];
  const shown = alerts.filter((a) => a.show);
  if (shown.length === 0) {
    return (
      <ToneCard tone="emerald" className="flex items-center gap-3 px-4 py-3">
        <CheckCircle2 size={18} aria-hidden="true" className="text-emerald-600" />
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
          You&rsquo;re all caught up. Nothing needs your attention right now.
        </p>
      </ToneCard>
    );
  }
  return (
    <section aria-label="Alerts" className="grid gap-3 md:grid-cols-2">
      {shown.map((a, i) => {
        const Icon = a.icon;
        return (
          <ToneCard key={a.text} tone={a.tone} index={i} interactive className="p-0">
            <button
              type="button"
              onClick={() => onFilter(a.filter)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <span className="relative flex">
                <ToneIcon tone={a.tone} icon={Icon} size="sm" />
                {a.tone === "indigo" || a.tone === "rose" ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full motion-safe:animate-ping",
                      toneClasses(a.tone).line,
                    )}
                  />
                ) : null}
              </span>
              <span className={cn("flex-1 text-sm font-medium", toneClasses(a.tone).text)}>
                {a.text}
              </span>
              <span className="text-xs font-medium text-neutral-500">
                Show <ArrowRight size={12} aria-hidden="true" className="inline" />
              </span>
            </button>
          </ToneCard>
        );
      })}
    </section>
  );
}

function StatCards({ d }: { d: StudentAssignmentDashboard }) {
  const c = d.counts;
  const dueThisWeek = d.items.filter(
    (i) =>
      !i.overdue &&
      i.dueInDays !== null &&
      i.dueInDays >= 0 &&
      i.dueInDays <= 7 &&
      (i.state === "NOT_STARTED" || i.state === "DRAFT" || i.state === "NEEDS_CHANGES"),
  ).length;
  const cards: { tone: Tone; icon: typeof Clock; label: string; value: string; hint: string }[] = [
    {
      tone: "indigo",
      icon: ClipboardList,
      label: "To do",
      value: String(c.toDo + c.needsChanges),
      hint: `${c.needsChanges} need changes`,
    },
    {
      tone: "amber",
      icon: CalendarClock,
      label: "Due this week",
      value: String(dueThisWeek),
      hint: c.overdue > 0 ? `${c.overdue} overdue` : "Nothing overdue",
    },
    {
      tone: "cyan",
      icon: Hourglass,
      label: "Waiting for review",
      value: String(c.waiting),
      hint: "Submitted, being marked",
    },
    {
      tone: "emerald",
      icon: Trophy,
      label: "Reviewed",
      value: String(c.reviewed),
      hint: d.averagePercent !== null ? `Average ${d.averagePercent}%` : "No marks yet",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((k, i) => (
        <ToneCard key={k.label} tone={k.tone} index={i} className="flex items-start gap-3 p-4">
          <ToneIcon tone={k.tone} icon={k.icon} />
          <div className="min-w-0">
            <p
              className={cn(
                "text-xs font-medium uppercase tracking-wide",
                toneClasses(k.tone).text,
              )}
            >
              {k.label}
            </p>
            <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
              {k.value}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{k.hint}</p>
          </div>
        </ToneCard>
      ))}
    </div>
  );
}

/** The next two weeks of deadlines for work that isn't submitted yet. */
function DeadlineTimeline({ d }: { d: StudentAssignmentDashboard }) {
  const upcoming = d.items
    .filter(
      (i) =>
        i.deadline &&
        i.dueInDays !== null &&
        i.dueInDays >= 0 &&
        i.dueInDays <= 14 &&
        (i.state === "NOT_STARTED" || i.state === "DRAFT" || i.state === "NEEDS_CHANGES"),
    )
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!));
  return (
    <Card className="motion-safe:animate-fade-up" style={stagger(4)}>
      <div className="mb-4 flex items-center gap-3">
        <ToneIcon tone="amber" icon={CalendarClock} size="sm" />
        <div>
          <h2 className="text-base font-semibold text-neutral-800 dark:text-white/90">
            Upcoming deadlines
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            The next 14 days, for work you haven&rsquo;t submitted yet.
          </p>
        </div>
      </div>
      {upcoming.length === 0 ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          No deadlines in the next two weeks.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-3 border-l-2 border-amber-200 pl-5 dark:border-amber-500/30">
          {upcoming.map((i, n) => {
            const urgent = (i.dueInDays ?? 99) <= 3;
            return (
              <li key={i.id} className="relative motion-safe:animate-fade-up" style={stagger(n)}>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white dark:ring-neutral-900",
                    urgent ? "bg-rose-500" : "bg-amber-400",
                  )}
                />
                <Link
                  href={hrefOf(i)}
                  className="group flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-amber-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-amber-500/5"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-neutral-800 group-hover:text-indigo-700 dark:text-white/90">
                      {i.title}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {fmt(i.deadline!)} · {STATE[i.state].label}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      urgent
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
                    )}
                  >
                    {dueText(i)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

function AssignmentCard({ i, index }: { i: StudentAssignmentItem; index: number }) {
  const s = STATE[i.state];
  const Icon = s.icon;
  const due = dueText(i);
  const tone: Tone = i.overdue ? "rose" : s.tone;
  return (
    <ToneCard
      tone={tone}
      index={Math.min(index, 8)}
      interactive
      className="flex h-full flex-col p-0"
    >
      <Link
        href={hrefOf(i)}
        className="flex h-full flex-col gap-3 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              toneClasses(s.tone).soft,
              toneClasses(s.tone).text,
            )}
          >
            <Icon size={12} aria-hidden="true" /> {s.label}
          </span>
          {i.isNew ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white">
              <Sparkles size={11} aria-hidden="true" /> New
            </span>
          ) : null}
          {due ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                i.overdue
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                  : i.dueInDays !== null && i.dueInDays <= 3 && i.dueInDays >= 0
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
                    : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300",
              )}
            >
              <Clock size={11} aria-hidden="true" /> {due}
            </span>
          ) : null}
        </div>
        <div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white">{i.title}</h3>
          {i.courseTitle ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{i.courseTitle}</p>
          ) : null}
        </div>
        <p className="line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">{i.brief}</p>
        {i.reviewerNote && (i.state === "NEEDS_CHANGES" || i.state === "REVIEWED") ? (
          <p
            className={cn(
              "rounded-md px-3 py-2 text-xs",
              toneClasses(s.tone).soft,
              toneClasses(s.tone).text,
            )}
          >
            <strong>Reviewer:</strong> {i.reviewerNote}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-sm">
          <span className="text-neutral-500">
            {i.obtainedMarks !== null ? (
              <strong className="text-emerald-700 dark:text-emerald-300">
                {i.obtainedMarks} / {i.marksTotal} marks
              </strong>
            ) : (
              `${i.marksTotal} marks`
            )}
          </span>
          <span
            className={cn("inline-flex items-center gap-1 font-semibold", toneClasses(tone).text)}
          >
            {s.action} <ArrowRight size={14} aria-hidden="true" />
          </span>
        </div>
      </Link>
    </ToneCard>
  );
}

// ----------------------------------------------------------------- page

function AssignmentsContent() {
  const api = useAssignmentApi();
  const dash = useLoad(() => api.dashboard(), "assignments-dashboard");
  const [filter, setFilter] = React.useState<Filter>("all");
  const listRef = React.useRef<HTMLDivElement>(null);
  const markedRef = React.useRef(false);

  // Once the page has been shown, today's assignments stop being "new" next time.
  React.useEffect(() => {
    if (!dash.data || markedRef.current) return;
    markedRef.current = true;
    void api.markSeen().catch(() => undefined);
  }, [dash.data, api]);

  if (dash.errorStatus !== null) {
    return <ErrorPanel status={dash.errorStatus} onRetry={dash.reload} />;
  }
  if (!dash.data) return <LoadingPanel />;
  const d = dash.data;
  const active = FILTERS.find((f) => f.key === filter)!;
  const shown = d.items.filter(active.test);

  function chooseFilter(f: Filter) {
    setFilter(f);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Assignments"
        subtitle={
          d.lastSeenAt
            ? `Your projects, deadlines and reviews. Last visit: ${fmt(d.lastSeenAt)}.`
            : "Your projects, deadlines and reviews."
        }
      />

      {d.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            heading="No assignments yet"
            body="Your mentors haven't published any assignments. They'll appear here with their deadlines."
          />
        </Card>
      ) : (
        <>
          <Alerts d={d} onFilter={chooseFilter} />
          <StatCards d={d} />
          <DeadlineTimeline d={d} />

          <div ref={listRef} className="scroll-mt-20">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ToneIcon tone="indigo" icon={BellRing} size="sm" />
                <h2 className="text-base font-semibold text-neutral-800 dark:text-white/90">
                  All assignments
                </h2>
              </div>
              <div
                role="tablist"
                aria-label="Filter assignments"
                className="flex flex-wrap gap-1.5"
              >
                {FILTERS.map((f) => {
                  const n = d.items.filter(f.test).length;
                  if (f.key !== "all" && n === 0) return null;
                  const selected = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setFilter(f.key)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                        selected
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300",
                      )}
                    >
                      {f.label} <span className="tabular-nums opacity-75">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {shown.length === 0 ? (
              <p className="text-sm text-neutral-500">Nothing here.</p>
            ) : (
              <ul key={filter} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((i, n) => (
                  <li key={i.id}>
                    <AssignmentCard i={i} index={n} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </main>
  );
}

export default function AssignmentCatalogPage() {
  return (
    <RequireAuth>
      <AssignmentsContent />
    </RequireAuth>
  );
}
