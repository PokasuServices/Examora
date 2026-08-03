"use client";

import { useAuth } from "@examora/auth-client";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import type { DashboardScope } from "./scope";

const SCOPE_OPTIONS: SegmentedOption<DashboardScope>[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Page-scoped strip, not a second global nav bar — greets the student and
 * drives the temporal scope shared by Learning Progress and Upcoming
 * Activities (see design spec §2.3 for why this belongs here, not in the
 * shell layout).
 */
export function TopNavigation({
  scope,
  onScopeChange,
}: {
  scope: DashboardScope;
  onScopeChange: (scope: DashboardScope) => void;
}) {
  const { user } = useAuth();
  const name = user?.firstName ?? "back";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-heading text-lg font-semibold text-neutral-900">
          {greeting()}, {name}
        </h2>
        <p className="text-sm text-neutral-500">{today}</p>
      </div>
      <SegmentedControl
        aria-label="Dashboard time scope"
        options={SCOPE_OPTIONS}
        value={scope}
        onChange={onScopeChange}
      />
    </div>
  );
}
