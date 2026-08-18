"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { NotificationDeliveryStatus, NotificationDetail } from "@examora/types";
import { Button, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
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

function DeliveryChips({ notification }: { notification: NotificationDetail }) {
  return (
    <div className="flex flex-wrap gap-1">
      {notification.deliveries.map((delivery) => (
        <span
          key={delivery.id}
          title={delivery.lastError ?? delivery.suppressedReason ?? undefined}
        >
          <Chip tone={STATUS_TONE[delivery.status]}>
            {delivery.channel} · {statusLabel(delivery.status)}
          </Chip>
        </span>
      ))}
    </div>
  );
}

function DeliveriesContent() {
  const api = useNotificationsAdminApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [items, setItems] = React.useState<NotificationDetail[]>([]);
  const [eventType, setEventType] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [userId, setUserId] = React.useState("");

  // Not memoized on purpose: the Search button must always read the latest
  // filter field values, and this is only ever called from that button or
  // the one-time mount effect below.
  function load(): void {
    setStatus("loading");
    api
      .list({
        eventType: eventType || undefined,
        category: category || undefined,
        userId: userId || undefined,
      })
      .then((res) => {
        setItems(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Notification deliveries"
        subtitle="Search the delivery log across every channel."
      />

      <Card density="compact">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eventType">Event type</Label>
            <Input
              id="eventType"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="e.g. commerce.payment_success"
              className="w-64"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="userId">User id</Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-64"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load notifications" onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState icon={Bell} heading="No notifications match" body="Try a different search." />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Title
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    User
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Event
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Deliveries
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Sent
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {items.map((notification) => (
                  <tr key={notification.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/notifications/${notification.id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {notification.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{notification.userEmail}</td>
                    <td className="px-4 py-3 text-neutral-600">{notification.eventType}</td>
                    <td className="px-4 py-3">
                      <DeliveryChips notification={notification} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                      {new Date(notification.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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
