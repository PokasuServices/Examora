import { CheckCircle2, Clock, Hourglass } from "lucide-react";
import type { MentorAssignmentReviewStats } from "@examora/types";
import { StatCard } from "@/components/dashboard/stat-card";

export function ReviewStatisticsSection({
  reviewStats,
}: {
  reviewStats: MentorAssignmentReviewStats;
}) {
  return (
    <section aria-labelledby="mentor-review-stats-heading">
      <h2
        id="mentor-review-stats-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Review Statistics
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Hourglass}
          tone="warning"
          label="Pending Review"
          value={String(reviewStats.pendingReview)}
          accessibleLabel="Submissions pending review"
        />
        <StatCard
          icon={CheckCircle2}
          tone="success"
          label="Reviewed This Month"
          value={String(reviewStats.reviewedThisMonth)}
          accessibleLabel="Submissions reviewed this month"
        />
        <StatCard
          icon={Clock}
          tone="accent"
          label="Avg. Turnaround"
          value={
            reviewStats.averageTurnaroundHours !== null
              ? `${reviewStats.averageTurnaroundHours}h`
              : "—"
          }
          accessibleLabel="Average review turnaround time in hours"
        />
      </div>
    </section>
  );
}
