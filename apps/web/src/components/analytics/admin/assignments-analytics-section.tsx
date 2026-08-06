import { ClipboardCheck, ClipboardList, Hourglass, Percent } from "lucide-react";
import type { AdminAssignmentAnalytics } from "@examora/types";
import { StatCard } from "@/components/dashboard/stat-card";
import { BreakdownBars, CHART_COLORS } from "@/components/analytics/charts";
import { Card } from "@/components/ui/card";

export function AssignmentsAnalyticsSection({
  assignments,
}: {
  assignments: AdminAssignmentAnalytics;
}) {
  return (
    <section aria-labelledby="admin-assignments-heading">
      <h2
        id="admin-assignments-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Assignments
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard
          icon={ClipboardList}
          tone="primary"
          label="Assignments"
          value={assignments.totalAssignments.toLocaleString()}
          accessibleLabel="Total assignments"
        />
        <StatCard
          icon={ClipboardList}
          tone="accent"
          label="Submissions"
          value={assignments.totalSubmissions.toLocaleString()}
          accessibleLabel="Total submissions"
        />
        <StatCard
          icon={ClipboardCheck}
          tone="success"
          label="Reviewed"
          value={assignments.reviewedCount.toLocaleString()}
          accessibleLabel="Reviewed submissions"
        />
        <StatCard
          icon={Hourglass}
          tone="warning"
          label="Pending Review"
          value={assignments.pendingReviewCount.toLocaleString()}
          accessibleLabel="Submissions pending review"
        />
        <StatCard
          icon={Percent}
          tone="primary"
          label="Avg. Marks"
          value={
            assignments.averageMarksPercent !== null ? `${assignments.averageMarksPercent}%` : "—"
          }
          accessibleLabel="Average marks percentage"
        />
      </div>
      {assignments.decisionBreakdown.length > 0 ? (
        <Card className="mt-3">
          <h3 className="font-heading text-sm font-semibold text-neutral-900">
            Decisions breakdown
          </h3>
          <div className="mt-4">
            <BreakdownBars
              items={assignments.decisionBreakdown.map((d) => ({
                label: d.decision.replace(/_/g, " ").toLowerCase(),
                value: d.count,
              }))}
              color={CHART_COLORS.primary}
            />
          </div>
        </Card>
      ) : null}
    </section>
  );
}
