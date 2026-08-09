"use client";

import { useAuth } from "@examora/auth-client";
import type {
  AuditLogEntry,
  PaginatedData,
  RoleName,
  UserProfile,
  UserStatus,
} from "@examora/types";

/** Typed wrappers over the existing admin user-management endpoints (users:manage) and the audit trail (audit_logs:read). No new backend routes. */
export function useAdminUsersApi() {
  const { request } = useAuth();

  return {
    listUsers: (params: { page?: number; pageSize?: number; role?: RoleName }) => {
      const query = new URLSearchParams();
      if (params.page) query.set("page", String(params.page));
      if (params.pageSize) query.set("pageSize", String(params.pageSize));
      if (params.role) query.set("role", params.role);
      const qs = query.toString();
      return request<PaginatedData<UserProfile>>(`/admin/users${qs ? `?${qs}` : ""}`, {
        method: "GET",
      });
    },

    getUser: (id: string) => request<UserProfile>(`/users/${id}`, { method: "GET" }),

    assignRoles: (id: string, roles: RoleName[]) =>
      request<UserProfile>(`/admin/users/${id}/roles`, { method: "PATCH", body: { roles } }),

    updateStatus: (id: string, status: UserStatus) =>
      request<UserProfile>(`/admin/users/${id}/status`, { method: "PATCH", body: { status } }),

    /** /admin/audit-logs only filters by entityType/actorId server-side — entityId is filtered client-side over this bounded fetch. */
    listAuditLogsByEntityType: (entityType: string, pageSize = 100) =>
      request<PaginatedData<AuditLogEntry>>(
        `/admin/audit-logs?entityType=${entityType}&pageSize=${pageSize}`,
        { method: "GET" },
      ),
  };
}
