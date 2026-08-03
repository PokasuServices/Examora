"use client";

import * as React from "react";
import Link from "next/link";
import type { NotificationSummary } from "@examora/types";
import { useNotificationsApi } from "@/lib/notifications-api";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { ListRowSkeleton } from "@/components/ui/skeleton";

type State =
  { status: "loading" } | { status: "error" } | { status: "ready"; data: NotificationSummary[] };

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationsWidget() {
  const api = useNotificationsApi();
  const [state, setState] = React.useState<State>({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  const load = React.useCallback(() => {
    setState({ status: "loading" });
    api
      .listMine({ page: 1, pageSize: 5 })
      .then((res) => setState({ status: "ready", data: res.items }))
      .catch(() => setState({ status: "error" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  React.useEffect(load, [load]);

  const hasUnread = state.status === "ready" && state.data.some((n) => !n.isRead);

  async function handleMarkAllRead() {
    await api.markAllRead();
    load();
  }

  return (
    <section aria-labelledby="notifications-heading">
      <div className="flex items-center justify-between">
        <h2
          id="notifications-heading"
          className="font-heading text-lg font-semibold text-neutral-900"
        >
          Notifications
        </h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            disabled={!hasUnread}
            aria-disabled={!hasUnread}
            title={hasUnread ? undefined : "Nothing to mark as read"}
            className="text-xs font-medium text-primary-600 hover:underline disabled:pointer-events-none disabled:text-neutral-300"
          >
            Mark all read
          </button>
          <Link
            href="/notifications"
            className="text-xs font-medium text-primary-600 hover:underline"
          >
            View all →
          </Link>
        </div>
      </div>

      <div className="mt-3">
        {state.status === "loading" ? (
          <>
            <ListRowSkeleton />
            <ListRowSkeleton />
          </>
        ) : state.status === "error" ? (
          <RetryInline
            message="Couldn't load notifications"
            onRetry={() => setAttempt((a) => a + 1)}
          />
        ) : state.data.length === 0 ? (
          <EmptyState heading="No new notifications" />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {state.data.map((n) => (
              <li key={n.id}>
                <Link
                  href="/notifications"
                  aria-label={`${n.isRead ? "" : "Unread: "}${n.title}`}
                  className="flex items-start gap-2 rounded-md py-2 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  {!n.isRead ? (
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="mt-1.5 h-2 w-2 shrink-0" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-neutral-800">{n.title}</span>
                    <span className="text-xs text-neutral-400">{timeAgo(n.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
