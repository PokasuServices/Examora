import { CreditCard, DollarSign, RotateCcw, Tag } from "lucide-react";
import type { AdminRevenueAnalytics } from "@examora/types";
import { StatCard } from "@/components/dashboard/stat-card";
import { ChartCard } from "@/components/analytics/chart-card";
import { CHART_COLORS, TrendAreaChart } from "@/components/analytics/charts";

export function RevenueSection({ revenue }: { revenue: AdminRevenueAnalytics }) {
  const chartData = revenue.revenueByDay.map((p) => ({
    date: new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    amount: p.amount,
  }));

  return (
    <section aria-labelledby="admin-revenue-heading">
      <h2
        id="admin-revenue-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Revenue
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard
          icon={DollarSign}
          tone="success"
          label="Total Revenue"
          value={`${revenue.currency} ${revenue.totalRevenue.toLocaleString()}`}
          accessibleLabel="Total revenue in range"
        />
        <StatCard
          icon={CreditCard}
          tone="primary"
          label="Orders Paid"
          value={revenue.ordersPaid.toLocaleString()}
          accessibleLabel="Orders paid in range"
        />
        <StatCard
          icon={DollarSign}
          tone="accent"
          label="Avg. Order Value"
          value={`${revenue.currency} ${revenue.averageOrderValue.toLocaleString()}`}
          accessibleLabel="Average order value"
        />
        <StatCard
          icon={RotateCcw}
          tone="danger"
          label="Refunded"
          value={`${revenue.currency} ${revenue.totalRefunded.toLocaleString()}`}
          accessibleLabel="Total refunded"
        />
        <StatCard
          icon={Tag}
          tone="warning"
          label="Coupon Redemptions"
          value={revenue.couponRedemptions.toLocaleString()}
          accessibleLabel="Coupon redemptions in range"
        />
      </div>
      <div className="mt-3">
        <ChartCard title="Revenue by day">
          <TrendAreaChart
            data={chartData}
            xKey="date"
            series={[{ key: "amount", label: "Revenue", color: CHART_COLORS.success }]}
            valueFormatter={(v) => `${revenue.currency} ${v.toLocaleString()}`}
          />
        </ChartCard>
      </div>
    </section>
  );
}
