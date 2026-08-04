import { AlertTriangle, CalendarCheck, ClipboardList, ListTodo, Users } from "lucide-react";
import type {
  MentorAssignmentReviewStats,
  MentorDashboard,
  MentorEngagementSummary,
} from "@examora/types";
import { StatCard } from "@/components/dashboard/stat-card";
import { meetingsThisWeekCount } from "./use-mentor-dashboard";

/**
 * Five cards answering the mentor's own goal questions. "Meetings Today"
 * from the spec is relabeled "Meetings This Week" — see
 * use-mentor-dashboard.ts's meetingsThisWeekCount for why (no scheduling
 * data exists, only a retrospective log).
 */
export function OverviewCards({
  dashboard,
  engagement,
  reviewStats,
}: {
  dashboard: MentorDashboard;
  engagement: MentorEngagementSummary;
  reviewStats: MentorAssignmentReviewStats;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        icon={Users}
        tone="primary"
        label="Assigned Students"
        value={String(dashboard.assignedStudents.length)}
        accessibleLabel="Assigned students"
      />
      <StatCard
        icon={ClipboardList}
        tone="warning"
        label="Pending Reviews"
        value={String(reviewStats.pendingReview)}
        accessibleLabel="Pending assignment reviews"
      />
      <StatCard
        icon={CalendarCheck}
        tone="accent"
        label="Meetings This Week"
        value={String(meetingsThisWeekCount(dashboard))}
        accessibleLabel="Meetings logged this week"
      />
      <StatCard
        icon={ListTodo}
        tone="primary"
        label="Open Tasks"
        value={String(dashboard.pendingTaskCount)}
        accessibleLabel="Open tasks"
      />
      <StatCard
        icon={AlertTriangle}
        tone="danger"
        label="Need Attention"
        value={String(engagement.studentsInactive14Days)}
        accessibleLabel="Students requiring attention — inactive 14 or more days"
      />
    </div>
  );
}
