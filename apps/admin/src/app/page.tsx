"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@examora/auth-client";

/**
 * apps/admin has no public/unauthenticated content (staff-only tool) — "/"
 * is a pure gate: authenticated users go straight to /dashboard, everyone
 * else goes to /login. This is also what makes logout behave correctly:
 * without this gate, "/" had no auth-status watcher at all, so logging out
 * while on it left the (now permission-empty) dashboard content on screen
 * instead of navigating anywhere.
 */
export default function AdminRootPage() {
  const router = useRouter();
  const { status } = useAuth();

  React.useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    } else if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-neutral-500">Loading…</p>
    </main>
  );
}
