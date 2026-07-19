"use client";

import * as React from "react";
import Link from "next/link";
import { useAuth } from "@examora/auth-client";
import type { PaginatedData, UserProfile } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";

function UsersListContent() {
  const { request } = useAuth();
  const [data, setData] = React.useState<PaginatedData<UserProfile> | null>(null);
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    request<PaginatedData<UserProfile>>(`/admin/users?page=${page}&pageSize=20`, { method: "GET" })
      .then(setData)
      .catch(() => undefined);
  }, [request, page]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-heading">Users</h1>
      <p className="mt-1 text-sm text-neutral-600">{data?.total ?? 0} total</p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Roles</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((user) => (
              <tr key={user.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/users/${user.id}`} className="text-primary-600 hover:underline">
                    {user.email}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="px-4 py-3">{user.roles.join(", ")}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={user.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          className="text-sm text-primary-600 hover:underline disabled:text-neutral-300"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <span className="text-sm text-neutral-500">Page {page}</span>
        <button
          type="button"
          className="text-sm text-primary-600 hover:underline disabled:text-neutral-300"
          disabled={!data || page * 20 >= data.total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: UserProfile["status"] }) {
  const colors: Record<UserProfile["status"], string> = {
    ACTIVE: "bg-success-500/10 text-success-600",
    PENDING_VERIFICATION: "bg-warning-500/10 text-warning-600",
    INACTIVE: "bg-neutral-200 text-neutral-600",
    SUSPENDED: "bg-error-500/10 text-error-600",
    ARCHIVED: "bg-neutral-200 text-neutral-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}>
      {status}
    </span>
  );
}

export default function UsersPage() {
  return (
    <RequirePermission permission="users:manage">
      <UsersListContent />
    </RequirePermission>
  );
}
