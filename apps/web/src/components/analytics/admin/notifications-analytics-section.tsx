import { Percent, Send } from "lucide-react";
import type { AdminNotificationDeliveryAnalytics } from "@examora/types";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function NotificationsAnalyticsSection({
  notifications,
}: {
  notifications: AdminNotificationDeliveryAnalytics;
}) {
  return (
    <section aria-labelledby="admin-notifications-heading">
      <h2
        id="admin-notifications-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Notifications
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-2">
        <StatCard
          icon={Send}
          tone="primary"
          label="Total Notifications"
          value={notifications.totalNotifications.toLocaleString()}
          accessibleLabel="Total notifications"
        />
        <StatCard
          icon={Percent}
          tone="success"
          label="Overall Success Rate"
          value={
            notifications.overallSuccessRate !== null ? `${notifications.overallSuccessRate}%` : "—"
          }
          accessibleLabel="Overall delivery success rate"
        />
      </div>
      <Card className="mt-3" density="compact">
        {notifications.deliveryByChannel.length === 0 ? (
          <EmptyState heading="No deliveries recorded yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">Queued</th>
                  <th className="px-3 py-2">Delivered</th>
                  <th className="px-3 py-2">Failed</th>
                  <th className="px-3 py-2">Suppressed</th>
                  <th className="px-3 py-2">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {notifications.deliveryByChannel.map((c) => (
                  <tr key={c.channel} className="hover:bg-neutral-50">
                    <td className="px-3 py-2.5 font-medium text-neutral-800">{c.channel}</td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">{c.queued}</td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">{c.delivered}</td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">{c.failed}</td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">{c.suppressed}</td>
                    <td className="px-3 py-2.5 tabular-nums text-neutral-600">
                      {c.successRate !== null ? `${c.successRate}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
