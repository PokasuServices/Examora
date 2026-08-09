import { ChartCard } from "@/components/analytics/chart-card";
import { CHART_COLORS, TrendAreaChart } from "@/components/analytics/charts";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/commerce-api";
import type { AdminRevenueAnalytics } from "@examora/types";
import type { MonthlyRevenuePoint } from "./use-admin-dashboard";

export function RevenueSection({
  revenue,
  monthlyRevenue,
}: {
  revenue: AdminRevenueAnalytics | null;
  monthlyRevenue: MonthlyRevenuePoint[];
}) {
  if (!revenue) return null;

  return (
    <section aria-labelledby="revenue-heading">
      <h2 id="revenue-heading" className="font-heading text-lg font-semibold text-neutral-900">
        Revenue overview
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Monthly revenue" subtitle="Paid orders, grouped by month">
            <TrendAreaChart
              data={monthlyRevenue}
              xKey="month"
              series={[{ key: "amount", label: "Revenue", color: CHART_COLORS.success }]}
              valueFormatter={(v) => formatMoney(v, revenue.currency)}
            />
          </ChartCard>
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <p className="text-xs font-medium text-neutral-500">Orders</p>
            <p className="mt-1 font-heading text-2xl font-bold text-neutral-900">
              {revenue.ordersPaid.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Avg. order value {formatMoney(revenue.averageOrderValue, revenue.currency)}
            </p>
          </Card>
          <Card>
            <p className="text-xs font-medium text-neutral-500">Refunds</p>
            <p className="mt-1 font-heading text-2xl font-bold text-neutral-900">
              {formatMoney(revenue.totalRefunded, revenue.currency)}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {revenue.couponRedemptions.toLocaleString()} coupon redemptions
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}
