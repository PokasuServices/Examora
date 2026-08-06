"use client";

import * as React from "react";
import type { NotificationSummary } from "@examora/types";
import { useNotificationsApi } from "@/lib/notifications-api";

type Status = "loading" | "ready" | "error";
export type ReadFilter = "all" | "unread" | "read";
export type DateFilter = "all" | "today" | "week" | "month";

export interface NotificationFilters {
  read: ReadFilter;
  category: string;
  date: DateFilter;
  q: string;
}

export const DEFAULT_NOTIFICATION_FILTERS: NotificationFilters = {
  read: "all",
  category: "all",
  date: "all",
  q: "",
};

function withinDateFilter(createdAt: string, filter: DateFilter): boolean {
  if (filter === "all") return true;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const day = 86_400_000;
  if (filter === "today") return ageMs < day;
  if (filter === "week") return ageMs < day * 7;
  return ageMs < day * 30;
}

/**
 * listMine() only supports server-side unreadOnly — there's no category or
 * date filter, and no full-text search endpoint for notifications. Same
 * pattern as the Community Board list: fetch a generous bounded batch once
 * (here, unreadOnly drives the fetch since it's the one real server filter),
 * then filter/paginate the rest client-side over real fields.
 */
export function useNotificationCenter() {
  const api = useNotificationsApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [items, setItems] = React.useState<NotificationSummary[]>([]);
  const [filters, setFilters] = React.useState<NotificationFilters>(DEFAULT_NOTIFICATION_FILTERS);
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<NotificationSummary | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listMine({ page: 1, pageSize: 100, unreadOnly: filters.read === "unread" })
      .then((res) => {
        setItems(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.read]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [filters]);

  const categories = React.useMemo(
    () => Array.from(new Set(items.map((n) => n.category))).sort(),
    [items],
  );

  const filtered = React.useMemo(() => {
    return items.filter((n) => {
      if (filters.read === "read" && !n.isRead) return false;
      if (filters.category !== "all" && n.category !== filters.category) return false;
      if (!withinDateFilter(n.createdAt, filters.date)) return false;
      if (filters.q.trim()) {
        const q = filters.q.trim().toLowerCase();
        if (!n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, filters]);

  const PAGE_SIZE = 15;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const unreadCount = items.filter((n) => !n.isRead).length;

  async function openDetail(notification: NotificationSummary): Promise<void> {
    setSelected(notification);
    if (!notification.isRead) {
      setItems((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
        ),
      );
      setSelected((prev) =>
        prev && prev.id === notification.id ? { ...prev, isRead: true } : prev,
      );
      await api.markRead(notification.id).catch(() => undefined);
    }
  }

  async function markAllRead(): Promise<void> {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await api.markAllRead().catch(() => undefined);
  }

  return {
    status,
    pageItems,
    filteredCount: filtered.length,
    totalCount: items.length,
    unreadCount,
    categories,
    filters,
    setFilters,
    page: clampedPage,
    pageCount,
    setPage,
    selected,
    openDetail,
    closeDetail: () => setSelected(null),
    markAllRead,
    retry: load,
  };
}
