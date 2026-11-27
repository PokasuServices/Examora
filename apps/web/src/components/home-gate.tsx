"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@examora/auth-client";
import type { AuthenticatedUser } from "@examora/types";
import { ADMIN_ORIGIN } from "@/components/admin-dashboard/admin-links";
import { STUDENT_HOME, isStudentView, usesStaffWorkspace } from "@/lib/student-view";

function landingRouteFor(user: AuthenticatedUser): string {
  if (user.permissions.includes("analytics:admin")) return "/admin";
  if (user.permissions.includes("mentor:workflow")) return "/mentor/dashboard";
  if (isStudentView(user)) return STUDENT_HOME;
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
      if (usesStaffWorkspace(user)) window.location.replace(ADMIN_ORIGIN);
      else router.replace(landingRouteFor(user));
    }
  }, [status, user, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      </main>
    );
  }

  return <>{children}</>;
}
