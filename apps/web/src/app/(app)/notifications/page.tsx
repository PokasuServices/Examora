"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@examora/auth-client";
import { Bell, Megaphone, Search, Settings } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Pagination } from "@/components/ui/pagination";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectField, type SelectFieldOption } from "@/components/ui/select-field";
import { NotificationCard } from "@/components/notifications/notification-card";
import { NotificationDetailPanel } from "@/components/notifications/notification-detail-panel";
import { NotificationCardSkeletonList } from "@/components/notifications/skeletons";
import { categoryMeta } from "@/components/notifications/types";
import {
  DEFAULT_NOTIFICATION_FILTERS,
  useNotificationCenter,
  type DateFilter,
  type ReadFilter,
} from "@/components/notifications/use-notification-center";

const READ_OPTIONS: { value: ReadFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];
const DATE_OPTIONS: SelectFieldOption[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

function NotificationCenterContent() {
  const { user } = useAuth();
  const data = useNotificationCenter();
  const canViewBroadcasts = user?.permissions.includes("notification:manage") ?? false;

  const categoryOptions: SelectFieldOption[] = [
    { value: "all", label: "All categories" },
    ...data.categories.map((c) => ({ value: c, label: categoryMeta(c).label })),
  ];

  function handleFilterChange<K extends keyof typeof data.filters>(
    key: K,
    value: (typeof data.filters)[K],
  ) {
    data.setFilters((f) => ({ ...f, [key]: value }));
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {data.unreadCount > 0
              ? `${data.unreadCount} unread notification${data.unreadCount === 1 ? "" : "s"}`
              : "You're all caught up."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data.unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void data.markAllRead()}
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              Mark all read
            </button>
          ) : null}
          {canViewBroadcasts ? (
            <Link
              href="/notifications/broadcasts"
              className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-primary-600"
            >
              <Megaphone size={15} strokeWidth={1.75} aria-hidden="true" />
              Broadcasts
            </Link>
          ) : null}
          <Link
            href="/notifications/preferences"
            className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-primary-600"
          >
            <Settings size={15} strokeWidth={1.75} aria-hidden="true" />
            Preferences
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          />
          <label htmlFor="notif-search" className="sr-only">
            Search notifications
          </label>
          <input
            id="notif-search"
            value={data.filters.q}
            onChange={(e) => handleFilterChange("q", e.target.value)}
            placeholder="Search notifications…"
            className="h-11 w-full rounded-md border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <SegmentedControl
            aria-label="Filter by read status"
            value={data.filters.read}
            onChange={(v) => handleFilterChange("read", v)}
            options={READ_OPTIONS}
          />
          <div className="min-w-[160px]">
            <SelectField
              id="notif-category"
              label="Category"
              value={data.filters.category}
              options={categoryOptions}
              onChange={(v) => handleFilterChange("category", v)}
            />
          </div>
          <div className="min-w-[140px]">
            <SelectField
              id="notif-date"
              label="Date"
              value={data.filters.date}
              options={DATE_OPTIONS}
              onChange={(v) => handleFilterChange("date", v as DateFilter)}
            />
          </div>
        </div>
      </div>

      {data.status === "loading" ? (
        <NotificationCardSkeletonList />
      ) : data.status === "error" ? (
        <RetryInline message="Couldn't load your notifications" onRetry={data.retry} />
      ) : data.totalCount === 0 ? (
        <EmptyState
          icon={Bell}
          heading="No notifications yet"
          body="Updates about your courses, assignments, community activity, and account will show up here."
        />
      ) : data.filteredCount === 0 ? (
        <EmptyState
          icon={Search}
          heading="No notifications match"
          body="Try a different search or filter."
          actionLabel="Clear filters"
          onAction={() => data.setFilters(DEFAULT_NOTIFICATION_FILTERS)}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {data.pageItems.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onOpen={data.openDetail}
              />
            ))}
          </div>
          <Pagination page={data.page} pageCount={data.pageCount} onChange={data.setPage} />
        </>
      )}

      <NotificationDetailPanel notification={data.selected} onClose={data.closeDetail} />
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
