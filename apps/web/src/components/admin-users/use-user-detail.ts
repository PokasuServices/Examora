"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { AuditLogEntry, RoleName, UserProfile, UserStatus } from "@examora/types";
import { useAdminUsersApi } from "@/lib/admin-users-api";

type Status = "loading" | "ready" | "not-found" | "error";
type MutationStatus = "idle" | "submitting" | "error";

export const AUDIT_FETCH_SIZE = 100;

export function useUserDetail(userId: string) {
  const api = useAdminUsersApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [auditEntries, setAuditEntries] = React.useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = React.useState(0);
  const [auditStatus, setAuditStatus] = React.useState<Status>("loading");

  const [roleMutation, setRoleMutation] = React.useState<MutationStatus>("idle");
  const [roleError, setRoleError] = React.useState<string | null>(null);
  const [statusMutation, setStatusMutation] = React.useState<MutationStatus>("idle");
  const [statusError, setStatusError] = React.useState<string | null>(null);

  const loadAudit = React.useCallback(() => {
    setAuditStatus("loading");
    api
      .listAuditLogsByEntityType("User", AUDIT_FETCH_SIZE)
      .then((res) => {
        const mine = res.items.filter((entry) => entry.entityId === userId);
        setAuditEntries(mine);
        setAuditTotal(res.total);
        setAuditStatus("ready");
      })
      .catch(() => setAuditStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .getUser(userId)
      .then((res) => {
        setUser(res);
        setStatus("ready");
      })
      .catch((err) => {
        setStatus(err instanceof ApiError && err.status === 404 ? "not-found" : "error");
      });

    loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loadAudit]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function saveRoles(roles: RoleName[]): Promise<boolean> {
    setRoleMutation("submitting");
    setRoleError(null);
    try {
      const updated = await api.assignRoles(userId, roles);
      setUser(updated);
      setRoleMutation("idle");
      loadAudit();
      return true;
    } catch (err) {
      setRoleMutation("error");
      setRoleError(err instanceof ApiError ? err.message : "Could not update roles.");
      return false;
    }
  }

  async function changeStatus(newStatus: UserStatus): Promise<boolean> {
    setStatusMutation("submitting");
    setStatusError(null);
    try {
      const updated = await api.updateStatus(userId, newStatus);
      setUser(updated);
      setStatusMutation("idle");
      loadAudit();
      return true;
    } catch (err) {
      setStatusMutation("error");
      setStatusError(err instanceof ApiError ? err.message : "Could not update account status.");
      return false;
    }
  }

  return {
    status,
    user,
    auditStatus,
    auditEntries,
    auditTotal,
    roleMutation,
    roleError,
    saveRoles,
    statusMutation,
    statusError,
    changeStatus,
    retry: load,
  };
}
