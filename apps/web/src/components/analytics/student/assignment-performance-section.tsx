import Link from "next/link";
import { ClipboardCheck, ClipboardList, Percent } from "lucide-react";
import type { AssignmentPerformanceSummary } from "@examora/types";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";

const DECISION_TONE: Record<string, ChipTone> = {
  APPROVED: "success",
  REVISION_REQUESTED: "warning",
  REJECTED: "danger",
};

export function AssignmentPerformanceSection({
  assignments,
}: {
  assignments: AssignmentPerformanceSummary;
}) {
  return (
    <section aria-labelledby="assignment-performance-heading">
      <h2
        id="assignment-performance-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Assignment Performance
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          icon={ClipboardList}
          tone="primary"
          label="Submitted"
          value={String(assignments.submittedCount)}
          accessibleLabel="Assignments submitted"
        />
        <StatCard
          icon={ClipboardCheck}
          tone="accent"
          label="Reviewed"
          value={String(assignments.reviewedCount)}
          accessibleLabel="Assignments reviewed"
        />
        <StatCard
          icon={Percent}
          tone="warning"
          label="Average Marks"
          value={
            assignments.averageMarksPercent !== null ? `${assignments.averageMarksPercent}%` : "—"
          }
          accessibleLabel="Average assignment marks"
        />
      </div>

      <Card className="mt-3" density="compact">
        {assignments.recentReviews.length === 0 ? (
          <EmptyState heading="No reviewed submissions yet" />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {assignments.recentReviews.map((r) => (
              <li
                key={r.submissionId}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <Link
                  href={`/assignments/submission/${r.submissionId}`}
                  className="min-w-0 flex-1 truncate text-neutral-800 hover:text-primary-600 hover:underline"
                >
                  {r.assignmentTitle}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums text-neutral-500">
                    {r.obtainedMarks !== null ? `${r.obtainedMarks}/${r.marksTotal}` : "Pending"}
                  </span>
                  {r.decision ? (
                    <Chip tone={DECISION_TONE[r.decision] ?? "neutral"}>
                      {r.decision.replace(/_/g, " ").toLowerCase()}
                    </Chip>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
