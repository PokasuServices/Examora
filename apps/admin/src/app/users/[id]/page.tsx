"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";

const STATUS_TONE: Record<UserStatus, ChipTone> = {
  ACTIVE: "success",
  PENDING_VERIFICATION: "warning",
  INACTIVE: "neutral",
  SUSPENDED: "danger",
  ARCHIVED: "neutral",
};

function UserDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { request } = useAuth();
  const [loadStatus, setLoadStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [selectedRoles, setSelectedRoles] = React.useState<RoleName[]>([]);
  const [selectedStatus, setSelectedStatus] = React.useState<UserStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [savingRoles, setSavingRoles] = React.useState(false);
  const [savingStatus, setSavingStatus] = React.useState(false);
  const [confirmRoles, setConfirmRoles] = React.useState(false);
  const [confirmStatus, setConfirmStatus] = React.useState(false);

  const load = React.useCallback(() => {
    setLoadStatus("loading");
    request<UserProfile>(`/users/${id}`, { method: "GET" })
      .then((data) => {
        setUser(data);
        setSelectedRoles(data.roles);
        setSelectedStatus(data.status);
        setLoadStatus("ready");
      })
      .catch(() => setLoadStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
      setConfirmRoles(false);
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
      setConfirmStatus(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update status");
    } finally {
      setSavingStatus(false);
    }
  }

  if (loadStatus === "loading") {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-32" />
        <Card>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-4 h-24 w-full" />
        </Card>
      </main>
    );
  }

  if (loadStatus === "error" || !user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <RetryInline message="Couldn't load this user" onRetry={load} />
        </Card>
      </main>
    );
  }

  const rolesChanged =
    JSON.stringify([...selectedRoles].sort()) !== JSON.stringify([...user.roles].sort());
  const statusChanged = selectedStatus !== user.status;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/users"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Users
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-bold text-neutral-900">{user.email}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-600">
            {[user.firstName, user.lastName].filter(Boolean).join(" ") || "No name on file"}
          </span>
          <Chip tone={user.emailVerified ? "success" : "warning"}>
            {user.emailVerified ? "Verified" : "Not verified"}
          </Chip>
          <Chip tone={STATUS_TONE[user.status]}>{statusLabel(user.status)}</Chip>
        </div>
      </div>

      <FieldError>{error}</FieldError>

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Roles</h2>
        <div className="mt-4 flex flex-col gap-2">
          {ROLE_NAMES.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={selectedRoles.includes(role)}
                onChange={() => toggleRole(role)}
                className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              />
              {role}
            </label>
          ))}
        </div>
        <Button className="mt-4" disabled={!rolesChanged} onClick={() => setConfirmRoles(true)}>
          Save roles
        </Button>
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Account status</h2>
        <div className="mt-4 max-w-xs">
          <SelectField
            id="user-status-select"
            label="Status"
            value={selectedStatus ?? user.status}
            options={USER_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
            onChange={(v) => setSelectedStatus(v as UserStatus)}
          />
        </div>
        <Button
          className="mt-4"
          variant="secondary"
          disabled={!statusChanged}
          onClick={() => setConfirmStatus(true)}
        >
          Update status
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmRoles}
        title="Update roles?"
        message={
          <>
            Change this user&rsquo;s roles to{" "}
            <span className="font-medium text-neutral-800">
              {selectedRoles.join(", ") || "none"}
            </span>
            ?
          </>
        }
        confirmLabel="Update roles"
        submitting={savingRoles}
        error={error}
        onConfirm={() => void saveRoles()}
        onCancel={() => setConfirmRoles(false)}
      />

      <ConfirmDialog
        open={confirmStatus}
        title="Change account status?"
        message={
          <>
            Change status from{" "}
            <span className="font-medium text-neutral-800">{statusLabel(user.status)}</span> to{" "}
            <span className="font-medium text-neutral-800">
              {statusLabel(selectedStatus ?? user.status)}
            </span>
            ?
          </>
        }
        confirmLabel="Update status"
        submitting={savingStatus}
        error={error}
        onConfirm={() => void saveStatus()}
        onCancel={() => setConfirmStatus(false)}
      />
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
