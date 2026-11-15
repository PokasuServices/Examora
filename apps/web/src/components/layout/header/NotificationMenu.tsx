"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import type { NotificationSummary } from "@examora/types";
import { cn } from "@examora/ui";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useNotificationsApi } from "@/lib/notifications-api";

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * TMS `header/NotificationMenu.vue` — bell with a pinging unread dot and
 * a dropdown of the latest notifications plus "View All", backed by the
 * caller's real Notification Center endpoints.
 */
export function NotificationMenu() {
  const api = useNotificationsApi();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const [items, setItems] = React.useState<NotificationSummary[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  const close = React.useCallback(() => setOpen(false), []);
  useClickOutside(rootRef, close, open);

  React.useEffect(() => {
    api
      .unreadCount()
      .then((res) => setUnread(res.unread))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setFailed(false);
      api
        .listMine({ pageSize: 8 })
        .then((res) => setItems(res.items))
        .catch(() => setFailed(true));
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
      >
        {unread > 0 ? (
          <span className="absolute right-0 top-0.5 z-1 flex h-2 w-2 rounded-full bg-warning-500">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning-500 opacity-75" />
          </span>
        ) : null}
        <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-neutral-200 bg-white p-3 shadow-theme-lg dark:border-neutral-800 dark:bg-neutral-900 sm:w-[361px] lg:right-0">
          <div className="mb-3 flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
            <h5 className="text-lg font-semibold text-neutral-800 dark:text-white/90">
              Notifications
              {unread > 0 ? (
                <span className="ml-2 text-sm font-normal text-neutral-500 dark:text-neutral-400">
                  {unread} unread
                </span>
              ) : null}
            </h5>
            <button
              type="button"
              onClick={close}
              aria-label="Close notifications"
              className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 dark:text-neutral-400"
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>

          <ul className="custom-scrollbar flex h-auto flex-1 flex-col overflow-y-auto">
            {failed ? (
              <li className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
                Couldn&apos;t load notifications.
              </li>
            ) : items === null ? (
              <li className="py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">
                Loading…
              </li>
            ) : items.length === 0 ? (
              <li className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
                You&apos;re all caught up.
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <Link
                    href="/notifications"
                    onClick={close}
                    className="flex gap-3 rounded-lg border-b border-neutral-100 px-4 py-3 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-white/5"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.isRead ? "bg-neutral-200 dark:bg-white/10" : "bg-primary-500",
                      )}
                    />
                    <span className="block min-w-0">
                      <span className="mb-1 block truncate text-sm font-medium text-neutral-800 dark:text-white/90">
                        {n.title}
                      </span>
                      <span className="mb-1.5 line-clamp-2 block text-sm text-neutral-500 dark:text-neutral-400">
                        {n.body}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                        <span className="capitalize">{n.category.toLowerCase()}</span>
                        <span className="h-1 w-1 rounded-full bg-neutral-400" />
                        <span>{timeAgo(n.createdAt)}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>

          <Link
            href="/notifications"
            onClick={close}
            className="mt-3 flex justify-center rounded-lg border border-neutral-300 bg-white p-3 text-sm font-medium text-neutral-700 shadow-theme-xs hover:bg-neutral-50 dark:hover:bg-white/[0.03] hover:text-neutral-800 dark:hover:text-white/90 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
          >
            View All Notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}
