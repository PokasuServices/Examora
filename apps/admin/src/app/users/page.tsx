"use client";

import * as React from "react";
import Link from "next/link";
import { Users as UsersIcon } from "lucide-react";
import { useAuth } from "@examora/auth-client";
import type { PaginatedData, UserProfile } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";

const PAGE_SIZE = 20;

const STATUS_TONE: Record<UserProfile["status"], ChipTone> = {
  ACTIVE: "success",
  PENDING_VERIFICATION: "warning",
  INACTIVE: "neutral",
  SUSPENDED: "danger",
  ARCHIVED: "neutral",
};

function UsersListContent() {
  const { request } = useAuth();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = React.useState<PaginatedData<UserProfile> | null>(null);
  const [page, setPage] = React.useState(1);

  const load = React.useCallback(() => {
    setStatus("loading");
    request<PaginatedData<UserProfile>>(`/admin/users?page=${page}&pageSize=${PAGE_SIZE}`, {
      method: "GET",
    })
      .then((res) => {
        setData(res);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  React.useEffect(() => {
    load();
  }, [load]);

  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Users"
        subtitle={data ? `${data.total.toLocaleString()} total` : undefined}
      />

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load users" onRetry={load} />
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState icon={UsersIcon} heading="No users found" />
        ) : (
          <>
            <div className="overflow-x-auto contain-layout">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Email
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Name
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Roles
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {(data?.items ?? []).map((user) => (
                    <tr key={user.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/users/${user.id}`}
                          className="font-medium text-primary-600 hover:underline"
                        >
                          {user.email}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{user.roles.join(", ")}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Chip tone={STATUS_TONE[user.status]}>{statusLabel(user.status)}</Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 p-4">
              <p className="text-xs text-neutral-500">
                Page {page} of {pageCount}
              </p>
              <Pagination page={page} pageCount={pageCount} onChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </main>
  );
}

export default function UsersPage() {
  return (
    <RequirePermission permission="users:manage">
      <UsersListContent />
    </RequirePermission>
  );
}
