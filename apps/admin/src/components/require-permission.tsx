"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@examora/auth-client";
import type { PermissionCode } from "@examora/types";

/** Gates an admin page behind a specific permission (DESIGN-03 §3). */
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
      <main>
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  if (!user?.permissions.includes(permission)) {
    return (
      <main>
        <h1 className="text-xl font-semibold text-neutral-800">Access denied</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Your account does not have permission to view this page.
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
