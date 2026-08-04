"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@examora/auth-client";
import type { PermissionCode } from "@examora/types";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

/** Gates a page behind a specific permission — same pattern apps/admin already uses, restyled onto this app's EmptyState. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionCode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { status, user } = useAuth();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  if (!user?.permissions.includes(permission)) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={Lock}
          heading="Access restricted"
          body="Your account doesn't have permission to view this page."
          actionLabel="Back to dashboard"
          actionHref="/dashboard"
        />
      </main>
    );
  }

  return <>{children}</>;
}
