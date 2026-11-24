"use client";

import * as React from "react";
import { Zap } from "lucide-react";
import { XP_MILESTONES } from "@examora/types";
import { ProgressBar } from "@/components/progress-bar";
import { RequireAuth } from "@/components/require-auth";
import { LoadingPanel } from "@/components/student/load-panels";
import { MilestoneCard } from "@/components/student/milestone-card";
import { Card } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { PageHeader } from "@/components/ui/page-header";
import { useXp } from "@/context/XpContext";

const WAYS_TO_EARN = [
  "Complete a lesson",
  "Finish a topic quiz (double for a perfect score)",
  "Finish a practice test",
  "Take the daily quiz",
];

function RewardsContent() {
  const { xp } = useXp();
  if (!xp) return <LoadingPanel />;

  const next = xp.nextMilestone;
  const previous = xp.currentMilestone ?? 0;
  const pct = next === null ? 100 : Math.round(((xp.totalXp - previous) / (next - previous)) * 100);
  const reachedCount = XP_MILESTONES.filter((m) => xp.totalXp >= m).length;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Rewards" subtitle="Earn XP as you study and unlock milestone badges." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-3">
            <IconBadge icon={Zap} tone="warning" />
            <div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Total XP</p>
              <p className="text-2xl font-semibold tabular-nums text-neutral-800 dark:text-white/90">
                {xp.totalXp.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">
                {next === null
                  ? "Every badge unlocked"
                  : `Next badge at ${next.toLocaleString("en-IN")} XP`}
              </span>
              {next !== null ? (
                <span className="font-medium text-neutral-800 dark:text-white/90">
                  {xp.xpToNext.toLocaleString("en-IN")} XP to go
                </span>
              ) : null}
            </div>
            <ProgressBar percent={pct} />
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">
            Ways to earn XP
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
            {WAYS_TO_EARN.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
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
