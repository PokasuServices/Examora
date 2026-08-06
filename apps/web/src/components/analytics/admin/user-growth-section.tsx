import type { AdminUserGrowthAnalytics } from "@examora/types";
import { ChartCard } from "@/components/analytics/chart-card";
import { BreakdownBars, CHART_COLORS, TrendAreaChart } from "@/components/analytics/charts";
import { Card } from "@/components/ui/card";

export function UserGrowthSection({ userGrowth }: { userGrowth: AdminUserGrowthAnalytics }) {
  const chartData = userGrowth.newUsersByDay.map((p) => ({
    date: new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    count: p.count,
  }));

  return (
    <section aria-labelledby="admin-user-growth-heading">
      <h2
        id="admin-user-growth-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        User Growth
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title="New users"
            subtitle={`Total users: ${userGrowth.totalUsers.toLocaleString()}`}
          >
            <TrendAreaChart
              data={chartData}
              xKey="date"
              series={[{ key: "count", label: "New users", color: CHART_COLORS.primary }]}
            />
          </ChartCard>
        </div>
        <Card>
          <h3 className="font-heading text-sm font-semibold text-neutral-900">By role</h3>
          <div className="mt-4">
            <BreakdownBars
              items={userGrowth.usersByRole.map((r) => ({ label: r.role, value: r.count }))}
              color={CHART_COLORS.accent}
            />
          </div>
        </Card>
      </div>
    </section>
  );
}
