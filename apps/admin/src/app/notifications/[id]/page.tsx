"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { NotificationDeliveryStatus, NotificationDetail } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { useNotificationsAdminApi } from "@/lib/notifications-api";

const STATUS_TONE: Record<NotificationDeliveryStatus, ChipTone> = {
  QUEUED: "neutral",
  SENT: "neutral",
  DELIVERED: "success",
  OPENED: "success",
  CLICKED: "success",
  ACKNOWLEDGED: "success",
  FAILED: "danger",
  RETRIED: "warning",
  SUPPRESSED: "neutral",
};

function NotificationDetailContent() {
  const { id } = useParams<{ id: string }>();
  const api = useNotificationsAdminApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "not-found">("loading");
  const [notification, setNotification] = React.useState<NotificationDetail | null>(null);

  React.useEffect(() => {
    setStatus("loading");
    api
      .getById(id)
      .then((res) => {
        setNotification(res);
        setStatus("ready");
      })
      .catch(() => setStatus("not-found"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function fallbackTarget(fallbackFromId: string): string {
    const source = notification!.deliveries.find((d) => d.id === fallbackFromId);
    return source ? `${source.channel} (${source.id.slice(0, 8)})` : fallbackFromId.slice(0, 8);
  }

  if (status === "loading") {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-32" />
        <Card>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-4 h-32 w-full" />
        </Card>
      </main>
    );
  }

  if (status === "not-found" || !notification) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-heading text-2xl font-bold text-neutral-900">Notification not found</h1>
        <Link
          href="/notifications"
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          ← Back to deliveries
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/notifications"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Deliveries
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-bold text-neutral-900">
          {notification.title}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {notification.userEmail} · {notification.eventType} · {notification.category}
        </p>
      </div>

      <Card>
        <p className="text-sm text-neutral-700">{notification.body}</p>
        <p className="mt-3 text-xs text-neutral-400">
          {notification.isTransactional
            ? "Transactional (bypasses preferences)"
            : "Preference-gated"}
          {" · "}
          {notification.isRead
            ? `Read ${notification.readAt ? new Date(notification.readAt).toLocaleString() : ""}`
            : "Unread"}
        </p>
      </Card>

      <div>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Deliveries</h2>
        <div className="mt-3 flex flex-col gap-3">
          {notification.deliveries.map((delivery) => (
            <Card key={delivery.id} density="compact">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-neutral-800">{delivery.channel}</span>
                <Chip tone={STATUS_TONE[delivery.status]}>{statusLabel(delivery.status)}</Chip>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-500">
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
                    <dd className="inline text-danger-600">{delivery.lastError}</dd>
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
            </Card>
          ))}
        </div>
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
