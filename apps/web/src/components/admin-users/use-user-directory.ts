"use client";

import * as React from "react";
import type { RoleName, UserProfile, UserStatus } from "@examora/types";
import { useAdminUsersApi } from "@/lib/admin-users-api";

type Status = "loading" | "ready" | "error";
export type RoleFilter = "ALL" | RoleName;
export type StatusFilter = "ALL" | UserStatus;

const PAGE_SIZE = 12;
/** /admin/users has no search or status filter — this fetch is the real, honest ceiling for those two refinements. */
const FETCH_SIZE = 100;

/**
 * /admin/users only supports role + pagination server-side (confirmed via
 * ListUsersQueryDto — no search, no status param). Role filtering refetches
 * from the server (accurate at any platform scale). Search and status are
 * applied client-side over this one fetch, same "bounded batch, client
 * refine" pattern as Order History — never implied as platform-wide.
 */
export function useUserDirectory() {
  const api = useAdminUsersApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [serverTotal, setServerTotal] = React.useState(0);
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listUsers({ pageSize: FETCH_SIZE, role: roleFilter === "ALL" ? undefined : roleFilter })
      .then((res) => {
        setUsers(res.items);
        setServerTotal(res.total);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [roleFilter, statusFilter, query]);

  const filtered = React.useMemo(() => {
    let result = users;
    if (statusFilter !== "ALL") {
      result = result.filter((u) => u.status === statusFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter((u) => {
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ").toLowerCase();
        return name.includes(q) || u.email.toLowerCase().includes(q);
      });
    }
    return result;
  }, [users, statusFilter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  return {
    status,
    pageItems,
    filteredCount: filtered.length,
    loadedCount: users.length,
    serverTotal,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    query,
    setQuery,
    page: clampedPage,
    pageCount,
    setPage,
    retry: load,
  };
}
