import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ADMIN_LINKS } from "./admin-links";
import type { AdminNotificationDeliveryAnalytics } from "@examora/types";

export function NotificationSection({
  notifications,
  templateCount,
}: {
  notifications: AdminNotificationDeliveryAnalytics | null;
  templateCount: number;
}) {
  if (!notifications) return null;

  return (
    <section aria-labelledby="notification-heading">
      <h2
        id="notification-heading"
        className="text-lg font-medium text-neutral-800 dark:text-white/90"
      >
        Notification overview
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-neutral-50 dark:bg-white/[0.03]">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Channel
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Delivered
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Failed
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Pending
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Success rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {notifications.deliveryByChannel.map((row) => (
                  <tr key={row.channel}>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-neutral-800 dark:text-white/90">
                      {row.channel}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-success-700 dark:text-success-300">
                      {row.delivered.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-danger-700 dark:text-danger-300">
                      {row.failed.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">
                      {row.queued.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">
                      {row.successRate !== null ? `${Math.round(row.successRate)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {notifications.overallSuccessRate !== null ? (
            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              {Math.round(notifications.overallSuccessRate)}% overall delivery success rate.
            </p>
          ) : null}
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <FileText
              size={16}
              strokeWidth={1.75}
              className="text-primary-600 dark:text-primary-400"
              aria-hidden="true"
            />
            <h3 className="font-heading text-sm font-semibold text-neutral-900 dark:text-white/90">
              Templates
            </h3>
          </div>
          <p className="mt-2 text-xl font-semibold text-neutral-800 dark:text-white/90">
            {templateCount}
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Reusable notification templates configured.
          </p>
          <a
            href={ADMIN_LINKS.notifications}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
          >
            Manage templates →
          </a>
        </Card>
      </div>
    </section>
  );
}
