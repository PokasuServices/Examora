"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@examora/auth-client";
import type { PermissionCode } from "@examora/types";

function landingRouteFor(permissions: PermissionCode[]): string {
  if (permissions.includes("analytics:admin")) return "/admin";
  if (permissions.includes("mentor:workflow")) return "/mentor/dashboard";
  return "/dashboard";
}

/**
 * "/" stays the public landing page for signed-out visitors. Signed-in
 * visitors are sent straight to their real application shell (student
 * dashboard, mentor dashboard, or admin dashboard) instead of seeing this
 * unshelled page as a second, competing logged-in experience.
 */
export function HomeGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, user } = useAuth();

  React.useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(landingRouteFor(user.permissions));
    }
  }, [status, user, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return <>{children}</>;
}
