import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck,
  Flame,
  HelpCircle,
  LogIn,
  type LucideIcon,
} from "lucide-react";
import type { ActivitySummary, LearningTimelineEntry } from "@examora/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBadge } from "@/components/ui/icon-badge";
import { StatCard } from "@/components/dashboard/stat-card";

const TIMELINE_META: Record<LearningTimelineEntry["type"], { label: string; icon: LucideIcon }> = {
  LESSON_COMPLETED: { label: "Completed a lesson", icon: CheckCircle2 },
  QUIZ_SUBMITTED: { label: "Submitted a quiz", icon: HelpCircle },
  ASSIGNMENT_SUBMITTED: { label: "Submitted an assignment", icon: ClipboardList },
  ASSIGNMENT_REVIEWED: { label: "Assignment reviewed", icon: FileCheck },
  COURSE_ENROLLED: { label: "Enrolled in a course", icon: LogIn },
};

export function ActivityTimelineSection({
  activity,
  timeline,
}: {
  activity: ActivitySummary;
  timeline: LearningTimelineEntry[];
}) {
  return (
    <section aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="font-heading text-lg font-semibold text-neutral-900">
        Activity Timeline
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          tone="primary"
          label="Active Days (7d)"
          value={String(activity.last7DaysActiveDays)}
          accessibleLabel="Active days in the last 7 days"
        />
        <StatCard
          icon={CalendarDays}
          tone="accent"
          label="Active Days (30d)"
          value={String(activity.last30DaysActiveDays)}
          accessibleLabel="Active days in the last 30 days"
        />
        <StatCard
          icon={Flame}
          tone="warning"
          label="Current Streak"
          value={`${activity.currentStreakDays}d`}
          accessibleLabel="Current activity streak in days"
        />
        <StatCard
          icon={LogIn}
          tone="success"
          label="Last Active"
          value={activity.lastActiveAt ? new Date(activity.lastActiveAt).toLocaleDateString() : "—"}
          accessibleLabel="Last active date"
        />
      </div>

      <Card className="mt-3" density="compact">
        {timeline.length === 0 ? (
          <EmptyState heading="No activity recorded yet" />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {timeline.map((entry, i) => {
              const meta = TIMELINE_META[entry.type];
              return (
                <li key={`${entry.occurredAt}-${i}`} className="flex items-start gap-3 py-2.5">
                  <IconBadge icon={meta.icon} tone="primary" size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-neutral-800">
                        {meta.label} — {entry.title}
                      </p>
                      <span className="shrink-0 text-xs text-neutral-400">
                        {new Date(entry.occurredAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
