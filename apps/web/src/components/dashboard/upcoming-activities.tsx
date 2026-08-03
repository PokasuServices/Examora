"use client";

import Link from "next/link";
import { ClipboardList, PartyPopper } from "lucide-react";
import { IconBadge } from "@/components/ui/icon-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { ListRowSkeleton } from "@/components/ui/skeleton";
import { DueChip } from "@/components/ui/chip";
import { useUpcomingAssignments, type UpcomingAssignment } from "./use-upcoming-assignments";
import { SCOPE_WINDOW_MS, type DashboardScope } from "./scope";

function groupLabel(deadline: string): "Today" | "Tomorrow" | "This week" | "Later" {
  const days = Math.floor(
    (new Date(deadline).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) /
      (1000 * 60 * 60 * 24),
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return "This week";
  return "Later";
}

function groupItems(items: UpcomingAssignment[]) {
  const groups: Record<string, UpcomingAssignment[]> = {};
  for (const item of items) {
    const label = groupLabel(item.deadline);
    (groups[label] ??= []).push(item);
  }
  return groups;
}

/**
 * Assignments only — no due-date concept exists for quizzes anywhere in the
 * platform, and mentor meetings are a past-tense log a student can't query
 * (not a scheduler). Adapted from the spec's three-source unified timeline.
 */
export function UpcomingActivities({ scope }: { scope: DashboardScope }) {
  const assignments = useUpcomingAssignments();

  return (
    <section aria-labelledby="upcoming-heading">
      <h2 id="upcoming-heading" className="font-heading text-lg font-semibold text-neutral-900">
        Upcoming
      </h2>

      <div className="mt-3">
        {assignments.status === "loading" ? (
          <>
            <ListRowSkeleton />
            <ListRowSkeleton />
          </>
        ) : assignments.status === "error" ? (
          <RetryInline message="Couldn't load your schedule" onRetry={assignments.retry} />
        ) : (
          (() => {
            const inWindow = assignments.data.filter(
              (a) => new Date(a.deadline).getTime() - Date.now() < SCOPE_WINDOW_MS[scope],
            );
            if (inWindow.length === 0) {
              return (
                <EmptyState
                  icon={PartyPopper}
                  tone="success"
                  heading="Nothing due"
                  body="Enjoy the breathing room."
                />
              );
            }
            const groups = groupItems(inWindow);
            const order = ["Today", "Tomorrow", "This week", "Later"] as const;
            return (
              <div className="flex flex-col gap-4">
                {order
                  .filter((label) => groups[label]?.length)
                  .map((label) => (
                    <div key={label}>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                        {label}
                      </h3>
                      <ul className="mt-1.5 flex flex-col divide-y divide-neutral-100">
                        {groups[label]!.map((item) => (
                          <li key={item.id}>
                            <Link
                              href={`/assignments/${item.id}`}
                              className="flex items-center gap-3 rounded-md py-2 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                            >
                              <IconBadge icon={ClipboardList} tone="primary" size={24} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-neutral-800">
                                  {item.title}
                                </span>
                              </span>
                              <DueChip dueAt={item.deadline} />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            );
          })()
        )}
      </div>
    </section>
  );
}
