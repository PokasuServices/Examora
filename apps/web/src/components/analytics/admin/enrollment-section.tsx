import { CheckCircle2, ShieldOff, Timer, UserPlus } from "lucide-react";
import type { AdminEnrollmentAnalytics } from "@examora/types";
import { StatCard } from "@/components/dashboard/stat-card";
import { ChartCard } from "@/components/analytics/chart-card";
import { BreakdownBars, CHART_COLORS, TrendAreaChart } from "@/components/analytics/charts";
import { Card } from "@/components/ui/card";

/** Not explicitly named in the brief's Admin Analytics list, but real and available from the same admin controller — omitting it would drop genuine, easy-to-surface data. */
export function EnrollmentSection({ enrollment }: { enrollment: AdminEnrollmentAnalytics }) {
  const chartData = enrollment.enrollmentsByDay.map((p) => ({
    date: new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    count: p.count,
  }));

  return (
    <section aria-labelledby="admin-enrollment-heading">
      <h2
        id="admin-enrollment-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Enrollment
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={UserPlus}
          tone="primary"
          label="Total Enrollments"
          value={enrollment.totalEnrollments.toLocaleString()}
          accessibleLabel="Total enrollments in range"
        />
        <StatCard
          icon={CheckCircle2}
          tone="success"
          label="Active"
          value={enrollment.activeEnrollments.toLocaleString()}
          accessibleLabel="Active enrollments"
        />
        <StatCard
          icon={Timer}
          tone="warning"
          label="Expired"
          value={enrollment.expiredEnrollments.toLocaleString()}
          accessibleLabel="Expired enrollments"
        />
        <StatCard
          icon={ShieldOff}
          tone="danger"
          label="Revoked"
          value={enrollment.revokedEnrollments.toLocaleString()}
          accessibleLabel="Revoked enrollments"
        />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Enrollments by day">
            <TrendAreaChart
              data={chartData}
              xKey="date"
              series={[{ key: "count", label: "Enrollments", color: CHART_COLORS.primary }]}
            />
          </ChartCard>
        </div>
        <Card>
          <h3 className="font-heading text-sm font-semibold text-neutral-900">By source</h3>
          <div className="mt-4">
            <BreakdownBars
              items={enrollment.enrollmentsBySource.map((s) => ({
                label: s.source,
                value: s.count,
              }))}
              color={CHART_COLORS.accent}
            />
          </div>
        </Card>
      </div>
    </section>
  );
}
