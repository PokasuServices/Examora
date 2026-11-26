"use client";

import * as React from "react";
import Link from "next/link";
import {
  Award,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Medal,
  Sparkles,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { XP_MILESTONES } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { StatGrid } from "@/components/student/dash-ui";
import { LoadingPanel } from "@/components/student/load-panels";
import { MilestoneCard } from "@/components/student/milestone-card";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { stagger, ToneCard, ToneIcon } from "@/components/ui/tone-card";
import { useXp } from "@/context/XpContext";
import { useDashboardsApi } from "@/lib/dashboards-api";
import { useStudentApi } from "@/lib/student-api";

const WAYS_TO_EARN: { label: string; href: string; icon: typeof Zap }[] = [
  { label: "Complete a lesson", href: "/learn", icon: BookOpen },
  { label: "Finish a topic quiz (double for 100%)", href: "/learn", icon: Sparkles },
  { label: "Finish a practice test", href: "/practice", icon: ClipboardCheck },
  { label: "Play the Daily Quiz", href: "/daily-quiz", icon: CalendarCheck },
  { label: "Rate your own sketch", href: "/sketches", icon: Award },
];

/** Bar colours for the "where your XP comes from" list, in order. */
const BAR = [
  "from-amber-400 to-amber-500",
  "from-indigo-400 to-indigo-500",
  "from-emerald-400 to-emerald-500",
  "from-cyan-400 to-cyan-500",
  "from-violet-400 to-violet-500",
  "from-rose-400 to-rose-500",
];

const WHEN = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

function RewardsContent() {
  const { xp } = useXp();
  const api = useDashboardsApi();
  const studentApi = useStudentApi();
  const dash = useLoad(() => api.rewards(), "rewards-dashboard");
  const daily = useLoad(() => studentApi.dailyDashboard(), "rewards-daily");
  if (!xp) return <LoadingPanel />;

  const next = xp.nextMilestone;
  const previous = xp.currentMilestone ?? 0;
  const pct = next === null ? 100 : Math.round(((xp.totalXp - previous) / (next - previous)) * 100);
  const reachedCount = XP_MILESTONES.filter((m) => xp.totalXp >= m).length;
  const d = dash.data;
  const awards = daily.data?.awards ?? [];
  const awardsEarned = awards.filter((a) => a.earned).length;
  const top = d?.byReason[0]?.amount ?? 1;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Rewards" subtitle="Earn XP as you study and unlock milestone badges." />

      <ToneCard tone="amber" className="p-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
            <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90" aria-hidden="true">
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                strokeWidth="3"
                className="stroke-amber-100 dark:stroke-amber-500/20"
              />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 97.4} 97.4`}
                className="stroke-amber-500 transition-[stroke-dasharray] duration-1000 motion-reduce:transition-none"
              />
            </svg>
            <Zap size={30} aria-hidden="true" className="absolute fill-amber-400 text-amber-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">
              Total XP
            </p>
            <p className="text-4xl font-bold tabular-nums text-neutral-900 dark:text-white">
              {xp.totalXp.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              {next === null ? (
                "Every badge unlocked. Legendary!"
              ) : (
                <>
                  <strong className="text-amber-700 dark:text-amber-300">
                    {xp.xpToNext.toLocaleString("en-IN")} XP
                  </strong>{" "}
                  to your next badge at {next.toLocaleString("en-IN")} XP ({pct}% there)
                </>
              )}
            </p>
          </div>
          {d ? (
            <div className="rounded-xl bg-white px-4 py-3 text-center shadow-sm ring-1 ring-amber-200 dark:bg-neutral-900 dark:ring-amber-500/30">
              <p className="text-xs text-neutral-500">This week</p>
              <p className="text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                +{d.thisWeek.toLocaleString("en-IN")}
              </p>
            </div>
          ) : null}
        </div>
      </ToneCard>

      <StatGrid
        stats={[
          {
            tone: "cyan",
            icon: CalendarDays,
            label: "This month",
            value: d ? `+${d.thisMonth.toLocaleString("en-IN")}` : "…",
            hint: "XP earned",
          },
          {
            tone: "violet",
            icon: Medal,
            label: "Badges",
            value: (
              <>
                {reachedCount}
                <span className="text-base font-normal text-neutral-400">
                  {" "}
                  / {XP_MILESTONES.length}
                </span>
              </>
            ),
            hint: "Milestone cards unlocked",
            onClick: () =>
              document.getElementById("badges")?.scrollIntoView({ behavior: "smooth" }),
          },
          {
            tone: "rose",
            icon: Trophy,
            label: "Daily Quiz awards",
            value: daily.data ? `${awardsEarned} / ${awards.length}` : "…",
            hint: "Streak, week, month and score",
            href: "/daily-quiz",
          },
          {
            tone: "emerald",
            icon: TrendingUp,
            label: "Daily streak",
            value: daily.data ? `${daily.data.stats.currentStreak} d` : "…",
            hint: daily.data ? `Best: ${daily.data.stats.bestStreak} days` : undefined,
            href: "/daily-quiz",
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="motion-safe:animate-fade-up" style={stagger(4)}>
          <div className="mb-4 flex items-center gap-3">
            <ToneIcon tone="amber" icon={Zap} size="sm" />
            <h2 className="text-base font-semibold text-neutral-800 dark:text-white/90">
              Where your XP comes from
            </h2>
          </div>
          {!d ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : d.byReason.length === 0 ? (
            <p className="text-sm text-neutral-500">Complete a lesson to earn your first XP!</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {d.byReason.map((r, i) => (
                <li key={r.reason} className="motion-safe:animate-fade-up" style={stagger(i)}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="text-neutral-700 dark:text-neutral-300">
                      {r.label} <span className="text-xs text-neutral-400">×{r.count}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-neutral-800 dark:text-white/90">
                      {r.amount.toLocaleString("en-IN")} XP
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/10">
                    <div
                      className={`h-full origin-left rounded-full bg-gradient-to-r ${BAR[i % BAR.length]} motion-safe:animate-grow-x`}
                      style={{
                        width: `${Math.max(3, (r.amount / top) * 100)}%`,
                        ...stagger(i, 90),
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="flex flex-col gap-6">
          <Card className="motion-safe:animate-fade-up" style={stagger(5)}>
            <h2 className="mb-3 text-sm font-semibold text-neutral-800 dark:text-white/90">
              Recent XP
            </h2>
            {d && d.recent.length > 0 ? (
              <ul className="flex flex-col gap-1.5 text-sm">
                {d.recent.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="flex items-center justify-between gap-2">
                    <span className="truncate text-neutral-600 dark:text-neutral-400">
                      {e.label}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {WHEN.format(new Date(e.at))}
                    </span>
                    <span className="w-14 shrink-0 text-right font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                      +{e.amount}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">Nothing yet.</p>
            )}
          </Card>
          <Card className="motion-safe:animate-fade-up" style={stagger(6)}>
            <h2 className="mb-3 text-sm font-semibold text-neutral-800 dark:text-white/90">
              Ways to earn XP
            </h2>
            <ul className="flex flex-col gap-1.5">
              {WAYS_TO_EARN.map((w) => {
                const Icon = w.icon;
                return (
                  <li key={w.label}>
                    <Link
                      href={w.href}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-300 dark:hover:bg-amber-500/10"
                    >
                      <Icon size={15} aria-hidden="true" className="text-amber-500" />
                      {w.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <Card id="badges" className="scroll-mt-20">
        <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">
          Badges{" "}
          <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">
            {reachedCount} of {XP_MILESTONES.length} unlocked
          </span>
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {XP_MILESTONES.map((m) => (
            <MilestoneCard key={m} xp={m} reached={xp.totalXp >= m} />
          ))}
        </ul>
      </Card>
    </main>
  );
}

export default function RewardsPage() {
  return (
    <RequireAuth>
      <RewardsContent />
    </RequireAuth>
  );
}
