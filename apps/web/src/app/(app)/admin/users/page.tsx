"use client";

import * as React from "react";
import { Filter, Search } from "lucide-react";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { FiltersSheet } from "@/components/courses/filters-sheet";
import { useAdminAnalyticsApi } from "@/lib/admin-analytics-api";
import { DirectoryStats } from "@/components/admin-users/directory-stats";
import { DirectoryFilterControls } from "@/components/admin-users/directory-filter-controls";
import { UserTable } from "@/components/admin-users/user-table";
import { useUserDirectory } from "@/components/admin-users/use-user-directory";
import type { AdminUserGrowthAnalytics } from "@examora/types";

function useDirectoryStatsData() {
  const api = useAdminAnalyticsApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [userGrowth, setUserGrowth] = React.useState<AdminUserGrowthAnalytics | null>(null);

  React.useEffect(() => {
    setStatus("loading");
    api
      .getUserGrowth(30)
      .then((res) => {
        setUserGrowth(res);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, userGrowth };
}

function UsersDirectoryContent() {
  const stats = useDirectoryStatsData();
  const {
    status,
    pageItems,
    filteredCount,
    loadedCount,
    serverTotal,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    query,
    setQuery,
    page,
    pageCount,
    setPage,
    retry,
  } = useUserDirectory();

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const activeFilterCount = statusFilter !== "ALL" ? 1 : 0;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">Users</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage students, mentors, reviewers and administrators.
        </p>
      </div>

      <DirectoryStats status={stats.status} userGrowth={stats.userGrowth} />

      <Card>
        <div className="hidden flex-col gap-3 lg:flex">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="h-10 w-full rounded-md border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              />
            </div>
          </div>
          <DirectoryFilterControls
            roleFilter={roleFilter}
            onRoleChange={setRoleFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
          />
          <p className="text-xs text-neutral-400">
            Search and status filter the {loadedCount.toLocaleString()} most recently loaded users
            {serverTotal > loadedCount ? ` of ${serverTotal.toLocaleString()} total` : ""} — role
            filtering queries the full directory.
          </p>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <div className="relative flex-1">
            <Search
              size={16}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="h-10 w-full rounded-md border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            className="relative flex h-10 shrink-0 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <Filter size={16} strokeWidth={1.75} aria-hidden="true" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-semibold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>
        <FiltersSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <DirectoryFilterControls
            roleFilter={roleFilter}
            onRoleChange={setRoleFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
          />
        </FiltersSheet>
      </Card>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load users" onRetry={retry} />
        ) : loadedCount === 0 ? (
          <EmptyState heading="No users found" body="No accounts match this role filter." />
        ) : filteredCount === 0 ? (
          <EmptyState
            heading="No users match your search"
            body="Try a different search term or filter."
          />
        ) : (
          <>
            <UserTable users={pageItems} />
            <div className="flex items-center justify-between gap-3 p-4">
              <p className="text-xs text-neutral-500">
                {filteredCount} {filteredCount === 1 ? "user" : "users"}
              </p>
              <Pagination page={page} pageCount={pageCount} onChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </main>
  );
}

export default function UsersDirectoryPage() {
  return (
    <RequirePermission permission="users:manage">
      <UsersDirectoryContent />
    </RequirePermission>
  );
}
