"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, History, ShieldCheck, User as UserIcon } from "lucide-react";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { IconBadge } from "@/components/ui/icon-badge";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileAvatar } from "@/components/settings/profile-avatar";
import { roleLabel } from "@/components/settings/format";
import { statusLabel } from "@/components/orders/format";
import { authorDisplayName } from "@/lib/format";
import { userStatusTone } from "@/components/admin-users/format";
import { RoleManager } from "@/components/admin-users/role-manager";
import { StatusManager } from "@/components/admin-users/status-manager";
import { UserAuditPanel } from "@/components/admin-users/user-audit-panel";
import { useUserDetail, AUDIT_FETCH_SIZE } from "@/components/admin-users/use-user-detail";

function UserDetailContent({ userId }: { userId: string }) {
  const {
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
    retry,
  } = useUserDetail(userId);

  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-32" />
        <Card>
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="mt-4 h-5 w-48" />
        </Card>
      </div>
    );
  }

  if (status === "not-found" || !user) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-heading text-2xl font-bold text-neutral-900">User not found</h1>
        <Link href="/admin/users" className="text-sm font-medium text-primary-600 hover:underline">
          ← Back to users
        </Link>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <RetryInline message="Couldn't load this user" onRetry={retry} />
        </Card>
      </div>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/admin/users"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Users
        </Link>
      </div>

      {/* Identity */}
      <Card>
        <div className="flex items-start gap-4">
          <ProfileAvatar user={user} size="xl" />
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold text-neutral-900">
              {authorDisplayName(user)}
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">{user.email}</p>
            {user.phone ? <p className="mt-0.5 text-sm text-neutral-500">{user.phone}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {user.roles.map((role) => (
                <Chip key={role} tone="primary">
                  {roleLabel(role)}
                </Chip>
              ))}
              <Chip tone={userStatusTone(user.status)}>{statusLabel(user.status)}</Chip>
              <Chip tone={user.emailVerified ? "success" : "warning"}>
                {user.emailVerified ? "Email verified" : "Email not verified"}
              </Chip>
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              Created{" "}
              {new Date(user.createdAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </Card>

      {/* Account status */}
      <Card>
        <div className="flex items-center gap-2">
          <IconBadge icon={ShieldCheck} tone="primary" />
          <h2 className="font-heading text-base font-semibold text-neutral-900">Account status</h2>
        </div>
        <div className="mt-4">
          <StatusManager
            currentStatus={user.status}
            mutationStatus={statusMutation}
            mutationError={statusError}
            onChange={changeStatus}
          />
        </div>
      </Card>

      {/* Roles */}
      <Card>
        <div className="flex items-center gap-2">
          <IconBadge icon={UserIcon} tone="primary" />
          <h2 className="font-heading text-base font-semibold text-neutral-900">Roles</h2>
        </div>
        <div className="mt-4">
          <RoleManager
            currentRoles={user.roles}
            mutationStatus={roleMutation}
            mutationError={roleError}
            onSave={saveRoles}
          />
        </div>
      </Card>

      {/* Activity / Audit */}
      <Card>
        <div className="flex items-center gap-2">
          <IconBadge icon={History} tone="primary" />
          <h2 className="font-heading text-base font-semibold text-neutral-900">
            Account activity
          </h2>
        </div>
        <div className="mt-4">
          <UserAuditPanel
            status={auditStatus}
            entries={auditEntries}
            total={auditTotal}
            fetchSize={AUDIT_FETCH_SIZE}
            onRetry={retry}
          />
        </div>
      </Card>
    </main>
  );
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequirePermission permission="users:manage">
      <UserDetailContent userId={id} />
    </RequirePermission>
  );
}
