import { ChartCard } from "@/components/analytics/chart-card";
import { CategoryBarChart, CHART_COLORS, BreakdownBars } from "@/components/analytics/charts";
import { Card } from "@/components/ui/card";
import type {
  AdminAssignmentAnalytics,
  AdminCoursePerformanceEntry,
  AdminQuizAnalytics,
} from "@examora/types";

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium tabular-nums text-neutral-800">{value}</span>
    </div>
  );
}

export function LearningSection({
  coursePerformance,
  quizzes,
  assignments,
}: {
  coursePerformance: AdminCoursePerformanceEntry[];
  quizzes: AdminQuizAnalytics | null;
  assignments: AdminAssignmentAnalytics | null;
}) {
  const topByCompletion = [...coursePerformance]
    .sort((a, b) => b.averageCompletionPercent - a.averageCompletionPercent)
    .slice(0, 8)
    .map((c) => ({ name: c.courseTitle, completion: Math.round(c.averageCompletionPercent) }));

  return (
    <section aria-labelledby="learning-heading">
      <h2 id="learning-heading" className="font-heading text-lg font-semibold text-neutral-900">
        Learning analytics
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ChartCard title="Course completion" subtitle="Average completion by course">
            <CategoryBarChart
              data={topByCompletion}
              nameKey="name"
              valueKey="completion"
              color={CHART_COLORS.primary}
              valueFormatter={(v) => `${v}%`}
              domain={[0, 100]}
            />
          </ChartCard>
        </div>

        <Card>
          <h3 className="font-heading text-sm font-semibold text-neutral-900">Quiz activity</h3>
          {quizzes ? (
            <div className="mt-3 divide-y divide-neutral-100">
              <StatRow label="Total quizzes" value={quizzes.totalQuizzes.toLocaleString()} />
              <StatRow label="Total attempts" value={quizzes.totalAttempts.toLocaleString()} />
              <StatRow
                label="Submitted attempts"
                value={quizzes.submittedAttempts.toLocaleString()}
              />
              <StatRow
                label="Average score"
                value={
                  quizzes.averagePercentage !== null
                    ? `${Math.round(quizzes.averagePercentage)}%`
                    : "—"
                }
              />
              <StatRow
                label="Pass rate"
                value={quizzes.passRate !== null ? `${Math.round(quizzes.passRate)}%` : "—"}
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-400">No data yet.</p>
          )}
        </Card>

        <Card>
          <h3 className="font-heading text-sm font-semibold text-neutral-900">
            Assignment activity
          </h3>
          {assignments ? (
            <>
              <div className="mt-3 divide-y divide-neutral-100">
                <StatRow
                  label="Total assignments"
                  value={assignments.totalAssignments.toLocaleString()}
                />
                <StatRow
                  label="Submissions"
                  value={assignments.totalSubmissions.toLocaleString()}
                />
                <StatRow label="Reviewed" value={assignments.reviewedCount.toLocaleString()} />
                <StatRow
                  label="Pending review"
                  value={assignments.pendingReviewCount.toLocaleString()}
                />
              </div>
              {assignments.decisionBreakdown.length > 0 ? (
                <div className="mt-4">
                  <BreakdownBars
                    items={assignments.decisionBreakdown.map((d) => ({
                      label: d.decision,
                      value: d.count,
                    }))}
                    color={CHART_COLORS.accent}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm text-neutral-400">No data yet.</p>
          )}
        </Card>
      </div>
    </section>
  );
}
