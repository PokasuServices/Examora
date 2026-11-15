"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@examora/auth-client";

/** Gates a page behind authentication, redirecting to /login when signed out. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <main className="mx-auto max-w-3xl">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      </main>
    );
  }

  return <>{children}</>;
}
