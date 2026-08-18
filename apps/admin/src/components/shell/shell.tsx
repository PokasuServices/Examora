"use client";

import * as React from "react";
import { useAuth } from "@examora/auth-client";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

/**
 * Persistent Sidebar + Header shell for every authenticated admin page.
 * Renders children bare (no shell chrome) while unauthenticated/loading —
 * covers /login and the brief pre-redirect window on every other route,
 * matching apps/web's (app) route-group split without needing to relocate
 * apps/admin's existing route tree (lower risk for a large, established app).
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  if (status !== "authenticated") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobileNav={() => setMobileNavOpen(true)} />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
