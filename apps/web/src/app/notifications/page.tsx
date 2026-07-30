"use client";

import * as React from "react";
import Link from "next/link";
import type { NotificationSummary } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { useNotificationsApi } from "@/lib/notifications-api";

function NotificationCenterContent() {
  const api = useNotificationsApi();
  const [items, setItems] = React.useState<NotificationSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [unreadOnly, setUnreadOnly] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    api
      .listMine({ pageSize: 50, unreadOnly })
      .then((res) => setItems(res.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string): Promise<void> {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await api.markRead(id).catch(() => undefined);
  }

  async function markAllRead(): Promise<void> {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await api.markAllRead().catch(() => undefined);
  }

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Notifications</h1>
        <Link
          href="/notifications/preferences"
          className="text-sm text-primary-600 hover:underline"
        >
          Preferences →
        </Link>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
          Unread only
        </label>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="text-sm text-primary-600 hover:underline"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      {loading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          {unreadOnly ? "No unread notifications." : "No notifications yet."}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="mt-6 flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {items.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                onClick={() => (notification.isRead ? undefined : void markRead(notification.id))}
                className={`flex w-full flex-col items-start gap-1 px-4 py-4 text-left text-sm hover:bg-neutral-50 ${
                  notification.isRead ? "" : "bg-primary-50/40"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-medium text-neutral-900">{notification.title}</span>
                  {!notification.isRead ? (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-primary-600"
                      aria-label="unread"
                    />
                  ) : null}
                </div>
                <p className="text-neutral-600">{notification.body}</p>
                <p className="text-xs text-neutral-400">
                  {new Date(notification.createdAt).toLocaleString()} · {notification.category}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}

export default function NotificationCenterPage() {
  return (
    <RequireAuth>
      <NotificationCenterContent />
    </RequireAuth>
  );
}
