import { ChartCard } from "@/components/analytics/chart-card";
import { BreakdownBars, CHART_COLORS, TrendAreaChart } from "@/components/analytics/charts";
import { Card } from "@/components/ui/card";
import type { AdminUserGrowthAnalytics } from "@examora/types";

export function UserGrowthSection({ userGrowth }: { userGrowth: AdminUserGrowthAnalytics | null }) {
  if (!userGrowth) return null;

  const chartData = userGrowth.newUsersByDay.map((p) => ({
    date: new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    count: p.count,
  }));
  const newRegistrations = userGrowth.newUsersByDay.reduce((sum, p) => sum + p.count, 0);

  return (
    <section aria-labelledby="user-growth-heading">
      <h2 id="user-growth-heading" className="font-heading text-lg font-semibold text-neutral-900">
        User growth
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard
            title="New registrations"
            subtitle={`${newRegistrations.toLocaleString()} new users in the last 30 days`}
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
          <div className="mt-3">
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
