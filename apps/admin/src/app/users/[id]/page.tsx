"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ApiError, useAuth } from "@examora/auth-client";
import {
  ROLE_NAMES,
  USER_STATUSES,
  type RoleName,
  type UserProfile,
  type UserStatus,
} from "@examora/types";
import { Button, FieldError } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";

function UserDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { request } = useAuth();
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [selectedRoles, setSelectedRoles] = React.useState<RoleName[]>([]);
  const [selectedStatus, setSelectedStatus] = React.useState<UserStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [savingRoles, setSavingRoles] = React.useState(false);
  const [savingStatus, setSavingStatus] = React.useState(false);

  const load = React.useCallback(() => {
    request<UserProfile>(`/users/${id}`, { method: "GET" })
      .then((data) => {
        setUser(data);
        setSelectedRoles(data.roles);
        setSelectedStatus(data.status);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Failed to load user"),
      );
  }, [request, id]);

  React.useEffect(() => {
    load();
  }, [load]);

  function toggleRole(role: RoleName): void {
    setSelectedRoles((current) =>
      current.includes(role) ? current.filter((r) => r !== role) : [...current, role],
    );
  }

  async function saveRoles(): Promise<void> {
    setError(null);
    setSavingRoles(true);
    try {
      const updated = await request<UserProfile>(`/admin/users/${id}/roles`, {
        method: "PATCH",
        body: { roles: selectedRoles },
      });
      setUser(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update roles");
    } finally {
      setSavingRoles(false);
    }
  }

  async function saveStatus(): Promise<void> {
    if (!selectedStatus) return;
    setError(null);
    setSavingStatus(true);
    try {
      const updated = await request<UserProfile>(`/admin/users/${id}/status`, {
        method: "PATCH",
        body: { status: selectedStatus },
      });
      setUser(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update status");
    } finally {
      setSavingStatus(false);
    }
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="text-heading">{user.email}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {[user.firstName, user.lastName].filter(Boolean).join(" ") || "No name on file"} ·{" "}
          {user.emailVerified ? "Verified" : "Not verified"}
        </p>
      </header>

      <FieldError>{error}</FieldError>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Roles</h2>
        <div className="mt-4 flex flex-col gap-2">
          {ROLE_NAMES.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedRoles.includes(role)}
                onChange={() => toggleRole(role)}
              />
              {role}
            </label>
          ))}
        </div>
        <Button className="mt-4" disabled={savingRoles} onClick={() => void saveRoles()}>
          {savingRoles ? "Saving…" : "Save roles"}
        </Button>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Account status</h2>
        <select
          className="mt-4 h-10 w-full rounded-md border border-neutral-300 px-3 text-sm"
          value={selectedStatus ?? ""}
          onChange={(e) => setSelectedStatus(e.target.value as UserStatus)}
        >
          {USER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <Button
          className="mt-4"
          variant="secondary"
          disabled={savingStatus}
          onClick={() => void saveStatus()}
        >
          {savingStatus ? "Saving…" : "Update status"}
        </Button>
      </section>
    </main>
  );
}

export default function UserDetailPage() {
  return (
    <RequirePermission permission="users:manage">
      <UserDetailContent />
    </RequirePermission>
  );
}
