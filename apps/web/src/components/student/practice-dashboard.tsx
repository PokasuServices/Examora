"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Brush,
  ClipboardCheck,
  Gauge,
  Hourglass,
  Play,
  Sparkles,
  Star,
} from "lucide-react";
import type { PracticeOverview, PracticeTestItem } from "@examora/types";
import { useLoad } from "@/components/student/use-load";
import { ToneCard, ToneIcon } from "@/components/ui/tone-card";
import { useDashboardsApi } from "@/lib/dashboards-api";
import { AlertStrip, StatGrid, useMarkSeenOnce, type DashAlert } from "./dash-ui";

const pct = (t: PracticeTestItem) =>
  t.lastScore && t.lastScore.total > 0
    ? Math.max(0, Math.round((t.lastScore.obtained / t.lastScore.total) * 100))
    : null;

/** Practice tab overview: tests, scores, what's next, and sketch (Part B) status. */
export function PracticeDashboard({ overview }: { overview: PracticeOverview }) {
  const api = useDashboardsApi();
  const summary = useLoad(() => api.practice(), "practice-summary");
  useMarkSeenOnce(Boolean(summary.data), () => api.markSeen("practice"));

  const tests = overview.categories.flatMap((c) =>
    c.tests.map((t) => ({ ...t, category: c.title })),
  );
  const taken = tests.filter((t) => t.lastScore);
  const scores = taken.map(pct).filter((p): p is number => p !== null);
  const average = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;
  const best = taken.reduce<(typeof taken)[number] | null>(
    (b, t) => ((pct(t) ?? -1) > (b ? (pct(b) ?? -1) : -1) ? t : b),
    null,
  );
  const inProgress = tests.filter((t) => t.inProgressAttemptId);
  const next = tests.find(
    (t) =>
      !t.lastScore &&
      !t.inProgressAttemptId &&
      !t.lockedBy &&
      (t.maxAttempts === null || t.attemptsUsed < t.maxAttempts),
  );
  const s = summary.data?.sketches;
  const latestReview = summary.data?.recentReviews[0];

  const alerts: DashAlert[] = [
    ...inProgress.slice(0, 2).map((t) => ({
      tone: "amber" as const,
      icon: Hourglass,
      text: `You left "${t.title}" in progress`,
      href: `/quizzes/attempt/${t.inProgressAttemptId}`,
      action: "Resume",
      pulse: true,
    })),
    ...(s && s.newExpertReviews > 0 && latestReview
      ? [
          {
            tone: "violet" as const,
            icon: Award,
            text: `${s.newExpertReviews} new expert ${s.newExpertReviews === 1 ? "review" : "reviews"} on your sketches`,
            href: latestReview.quizId
              ? `/practice/sketches/work/${latestReview.workId}?paper=${latestReview.quizId}`
              : `/practice/sketches/work/${latestReview.workId}`,
            action: "See marks",
            pulse: true,
          },
        ]
      : []),
    ...(s && s.toSelfEvaluate > 0
      ? [
          {
            tone: "indigo" as const,
            icon: Star,
            text: `Evaluate yourself on ${s.toSelfEvaluate} ${s.toSelfEvaluate === 1 ? "sketch" : "sketches"} (+10 XP each)`,
            href: "/sketches",
            action: "Open",
          },
        ]
      : []),
    ...(overview.weakTopics.length > 0
      ? [
          {
            tone: "rose" as const,
            icon: AlertTriangle,
            text: `${overview.weakTopics.length} ${overview.weakTopics.length === 1 ? "topic needs" : "topics need"} revision`,
            onClick: () =>
              document.getElementById("needs-attention")?.scrollIntoView({ behavior: "smooth" }),
            action: "Show",
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      {next ? (
        <ToneCard tone="indigo" className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <ToneIcon tone="indigo" icon={Play} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-indigo-700/80 dark:text-indigo-300/80">
                Up next · {next.category}
              </p>
              <p className="truncate text-lg font-semibold text-neutral-900 dark:text-white">
                {next.title}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {next.questionCount} questions
                {next.timeLimitMinutes ? ` · ${next.timeLimitMinutes} min` : ""}
                {next.sketchCount > 0 ? ` · Part B: ${next.sketchCount} sketches` : ""}
                {next.xpReward > 0 ? ` · +${next.xpReward} XP` : ""}
              </p>
            </div>
            <Link
              href={`/practice/tests/${next.id}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
            >
              Open test <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </ToneCard>
      ) : null}

      <StatGrid
        stats={[
          {
            tone: "indigo",
            icon: ClipboardCheck,
            label: "Tests taken",
            value: (
              <>
                {taken.length}
                <span className="text-base font-normal text-neutral-400"> / {tests.length}</span>
              </>
            ),
            hint: `${tests.length - taken.length} still to try`,
          },
          {
            tone: "emerald",
            icon: Gauge,
            label: "Average score",
            value: average === null ? "—" : `${average}%`,
            hint:
              best && pct(best) !== null
                ? `Best: ${pct(best)}% in ${best.title}`
                : "Take a test to see it",
          },
          {
            tone: "violet",
            icon: Brush,
            label: "Sketches",
            value: s ? String(s.uploads) : "…",
            hint: s ? `${s.waitingForExpert} waiting for an expert` : undefined,
            href: "/sketches",
          },
          {
            tone: "rose",
            icon: Sparkles,
            label: "To revise",
            value: String(overview.weakTopics.length),
            hint: "Topics you were sure of but got wrong",
          },
        ]}
      />

      <AlertStrip alerts={alerts} />
    </div>
  );
}
