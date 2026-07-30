"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { NotificationDeliveryStatus, NotificationDetail } from "@examora/types";
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

function NotificationDetailContent() {
  const { id } = useParams<{ id: string }>();
  const api = useNotificationsAdminApi();
  const [notification, setNotification] = React.useState<NotificationDetail | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    api
      .getById(id)
      .then(setNotification)
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-heading">Notification not found</h1>
      </main>
    );
  }
  if (!notification) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  function fallbackTarget(fallbackFromId: string): string {
    const source = notification!.deliveries.find((d) => d.id === fallbackFromId);
    return source ? `${source.channel} (${source.id.slice(0, 8)})` : fallbackFromId.slice(0, 8);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/notifications" className="hover:underline">
          Deliveries
        </Link>{" "}
        · <span className="text-neutral-800">{notification.title}</span>
      </nav>

      <h1 className="text-heading">{notification.title}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {notification.userEmail} · {notification.eventType} · {notification.category}
      </p>
      <p className="mt-4 text-sm text-neutral-700">{notification.body}</p>
      <p className="mt-2 text-xs text-neutral-400">
        {notification.isTransactional ? "Transactional (bypasses preferences)" : "Preference-gated"}{" "}
        ·{" "}
        {notification.isRead
          ? `Read ${notification.readAt ? new Date(notification.readAt).toLocaleString() : ""}`
          : "Unread"}
      </p>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-700">Deliveries</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {notification.deliveries.map((delivery) => (
            <li
              key={delivery.id}
              className="rounded-lg border border-neutral-200 bg-white p-4 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{delivery.channel}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[delivery.status]}`}
                >
                  {delivery.status}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-500">
                <div>
                  <dt className="inline">Attempts: </dt>
                  <dd className="inline text-neutral-700">{delivery.attempts}</dd>
                </div>
                {delivery.sentAt ? (
                  <div>
                    <dt className="inline">Sent: </dt>
                    <dd className="inline text-neutral-700">
                      {new Date(delivery.sentAt).toLocaleString()}
                    </dd>
                  </div>
                ) : null}
                {delivery.deliveredAt ? (
                  <div>
                    <dt className="inline">Delivered: </dt>
                    <dd className="inline text-neutral-700">
                      {new Date(delivery.deliveredAt).toLocaleString()}
                    </dd>
                  </div>
                ) : null}
                {delivery.failedAt ? (
                  <div>
                    <dt className="inline">Failed: </dt>
                    <dd className="inline text-neutral-700">
                      {new Date(delivery.failedAt).toLocaleString()}
                    </dd>
                  </div>
                ) : null}
                {delivery.lastError ? (
                  <div className="col-span-2">
                    <dt className="inline">Last error: </dt>
                    <dd className="inline text-error-600">{delivery.lastError}</dd>
                  </div>
                ) : null}
                {delivery.suppressedReason ? (
                  <div className="col-span-2">
                    <dt className="inline">Suppressed: </dt>
                    <dd className="inline text-neutral-700">{delivery.suppressedReason}</dd>
                  </div>
                ) : null}
                {delivery.fallbackFromId ? (
                  <div className="col-span-2">
                    <dt className="inline">Fallback from: </dt>
                    <dd className="inline text-neutral-700">
                      {fallbackTarget(delivery.fallbackFromId)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

export default function NotificationDetailPage() {
  return (
    <RequirePermission permission="notification:manage">
      <NotificationDetailContent />
    </RequirePermission>
  );
}
