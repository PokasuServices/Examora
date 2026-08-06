import { AlertTriangle, UserCheck, Users } from "lucide-react";
import type { MentorEngagementSummary } from "@examora/types";
import { StatCard } from "@/components/dashboard/stat-card";

/**
 * Just the three real counts as StatCards — no derived "split" chart:
 * studentsActiveLast7Days and studentsInactive14Days aren't complementary
 * halves of totalStudents (a student active 8-13 days ago falls into
 * neither bucket), so forcing them into a proportional breakdown would
 * imply a relationship the data doesn't actually have.
 */
export function EngagementSection({ engagement }: { engagement: MentorEngagementSummary }) {
  return (
    <section aria-labelledby="mentor-engagement-heading">
      <h2
        id="mentor-engagement-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Engagement
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Users}
          tone="primary"
          label="Total Students"
          value={String(engagement.totalStudents)}
          accessibleLabel="Total assigned students"
        />
        <StatCard
          icon={UserCheck}
          tone="success"
          label="Active (7d)"
          value={String(engagement.studentsActiveLast7Days)}
          accessibleLabel="Students active in the last 7 days"
        />
        <StatCard
          icon={AlertTriangle}
          tone="danger"
          label="Inactive 14+ Days"
          value={String(engagement.studentsInactive14Days)}
          accessibleLabel="Students inactive for 14 or more days, or never active"
        />
      </div>
    </section>
  );
}
