"use client";

import * as React from "react";
import Link from "next/link";
import type { NotificationDeliveryStatus, NotificationDetail } from "@examora/types";
import { NotificationsNav } from "@/components/notifications-nav";
import { RequirePermission } from "@/components/require-permission";
import { useNotificationsAdminApi } from "@/lib/notifications-api";

const STATUS_STYLES: Record<NotificationDeliveryStatus, string> = {
  QUEUED: "bg-neutral-100 text-neutral-600",
  SENT: "bg-neutral-100 text-neutral-600",
  DELIVERED: "bg-success-50 text-success-700",
  OPENED: "bg-success-50 text-success-700",
  CLICKED: "bg-success-50 text-success-700",
  ACKNOWLEDGED: "bg-success-50 text-success-700",
  FAILED: "bg-error-50 text-error-700",
  RETRIED: "bg-amber-50 text-amber-700",
  SUPPRESSED: "bg-neutral-100 text-neutral-500",
};

function DeliveryChips({ notification }: { notification: NotificationDetail }) {
  return (
    <div className="flex flex-wrap gap-1">
      {notification.deliveries.map((delivery) => (
        <span
          key={delivery.id}
          title={delivery.lastError ?? delivery.suppressedReason ?? undefined}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[delivery.status]}`}
        >
          {delivery.channel} · {delivery.status}
        </span>
      ))}
    </div>
  );
}

function DeliveriesContent() {
  const api = useNotificationsAdminApi();
  const [items, setItems] = React.useState<NotificationDetail[]>([]);
  const [eventType, setEventType] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    api
      .list({
        eventType: eventType || undefined,
        category: category || undefined,
        userId: userId || undefined,
      })
      .then((res) => setItems(res.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <NotificationsNav />
      <h1 className="text-heading">Notification deliveries</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-800" htmlFor="eventType">
            Event type
          </label>
          <input
            id="eventType"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            placeholder="e.g. commerce.payment_success"
            className="h-9 w-64 rounded-md border border-neutral-300 px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-800" htmlFor="category">
            Category
          </label>
          <input
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 w-40 rounded-md border border-neutral-300 px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-800" htmlFor="userId">
            User id
          </label>
          <input
            id="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="h-9 w-64 rounded-md border border-neutral-300 px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700"
        >
          Search
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Deliveries</th>
              <th className="px-4 py-3 font-medium">Sent</th>
            </tr>
          </thead>
          <tbody>
            {items.map((notification) => (
              <tr key={notification.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/notifications/${notification.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    {notification.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-600">{notification.userEmail}</td>
                <td className="px-4 py-3 text-neutral-600">{notification.eventType}</td>
                <td className="px-4 py-3">
                  <DeliveryChips notification={notification} />
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {new Date(notification.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No notifications match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function NotificationDeliveriesPage() {
  return (
    <RequirePermission permission="notification:manage">
      <DeliveriesContent />
    </RequirePermission>
  );
}
