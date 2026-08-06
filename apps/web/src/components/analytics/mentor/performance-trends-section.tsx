import { ListChecks, Percent, Target } from "lucide-react";
import type { MentorPerformanceTrendPoint, MentorQuizPerformanceSummary } from "@examora/types";
import { ChartCard } from "@/components/analytics/chart-card";
import { CHART_COLORS, TrendLineChart } from "@/components/analytics/charts";
import { StatCard } from "@/components/dashboard/stat-card";

export function PerformanceTrendsSection({
  trends,
  quiz,
}: {
  trends: MentorPerformanceTrendPoint[];
  quiz: MentorQuizPerformanceSummary;
}) {
  const chartData = trends.map((t) => ({
    week: new Date(t.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    quiz: t.averageQuizPercentage,
    assignment: t.averageAssignmentPercentage,
  }));

  return (
    <section aria-labelledby="mentor-trends-heading">
      <h2
        id="mentor-trends-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Performance Trends
      </h2>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={ListChecks}
          tone="primary"
          label="Students With Attempts"
          value={String(quiz.studentCount)}
          accessibleLabel="Students with quiz attempts"
        />
        <StatCard
          icon={Percent}
          tone="accent"
          label="Average Quiz Score"
          value={quiz.averagePercentage !== null ? `${quiz.averagePercentage}%` : "—"}
          accessibleLabel="Average quiz score across my students"
        />
        <StatCard
          icon={Target}
          tone="success"
          label="Pass Rate"
          value={quiz.passRate !== null ? `${quiz.passRate}%` : "—"}
          accessibleLabel="Quiz pass rate across my students"
        />
      </div>

      <div className="mt-3">
        <ChartCard
          title="Weekly quiz & assignment averages"
          subtitle="Across all your assigned students"
        >
          <TrendLineChart
            data={chartData}
            xKey="week"
            series={[
              { key: "quiz", label: "Quiz average", color: CHART_COLORS.primary },
              { key: "assignment", label: "Assignment average", color: CHART_COLORS.success },
            ]}
            valueFormatter={(v) => `${v}%`}
          />
        </ChartCard>
      </div>
    </section>
  );
}
