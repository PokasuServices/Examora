"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@examora/auth-client";
import { staffHome } from "@/lib/staff-home";

/**
 * apps/admin has no public/unauthenticated content (staff-only tool) — "/"
 * is a pure gate: authenticated users go straight to their staff home
 * (administrators: /dashboard; mentors: their mentor dashboard), everyone
 * else goes to /login. Every "home" link points here for that reason. This is also what makes logout behave correctly:
 * without this gate, "/" had no auth-status watcher at all, so logging out
 * while on it left the (now permission-empty) dashboard content on screen
 * instead of navigating anywhere.
 */
export default function AdminRootPage() {
  const router = useRouter();
  const { status, user } = useAuth();

  React.useEffect(() => {
    if (status === "authenticated") {
      router.replace(staffHome(user));
    } else if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, user, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
    </main>
  );
}
