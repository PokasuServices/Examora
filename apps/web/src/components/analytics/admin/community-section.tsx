import { CheckCircle2, Flag, MessageSquare, ShieldAlert } from "lucide-react";
import type { AdminCommunityAnalytics } from "@examora/types";
import { StatCard } from "@/components/dashboard/stat-card";
import { ChartCard } from "@/components/analytics/chart-card";
import { CHART_COLORS, TrendAreaChart } from "@/components/analytics/charts";

export function CommunitySection({ community }: { community: AdminCommunityAnalytics }) {
  const chartData = community.threadsByDay.map((p) => ({
    date: new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    count: p.count,
  }));

  return (
    <section aria-labelledby="admin-community-heading">
      <h2
        id="admin-community-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Community
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard
          icon={MessageSquare}
          tone="primary"
          label="Threads"
          value={community.totalThreads.toLocaleString()}
          accessibleLabel="Total threads"
        />
        <StatCard
          icon={MessageSquare}
          tone="accent"
          label="Replies"
          value={community.totalReplies.toLocaleString()}
          accessibleLabel="Total replies"
        />
        <StatCard
          icon={CheckCircle2}
          tone="success"
          label="Accepted Answer Rate"
          value={community.acceptedAnswerRate !== null ? `${community.acceptedAnswerRate}%` : "—"}
          accessibleLabel="Accepted answer rate"
        />
        <StatCard
          icon={ShieldAlert}
          tone="warning"
          label="Moderation Actions"
          value={community.moderationActionsCount.toLocaleString()}
          accessibleLabel="Moderation actions in range"
        />
        <StatCard
          icon={Flag}
          tone="danger"
          label="Open Reports"
          value={community.openReportsCount.toLocaleString()}
          accessibleLabel="Open moderation reports"
        />
      </div>
      <div className="mt-3">
        <ChartCard title="New threads by day">
          <TrendAreaChart
            data={chartData}
            xKey="date"
            series={[{ key: "count", label: "Threads", color: CHART_COLORS.primary }]}
          />
        </ChartCard>
      </div>
    </section>
  );
}
