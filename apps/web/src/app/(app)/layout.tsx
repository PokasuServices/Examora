"use client";

import * as React from "react";
import { Header } from "@/components/shell/header";
import { Sidebar } from "@/components/shell/sidebar";

/**
 * Shell for every authenticated page (previously most had no persistent
 * navigation at all — only the public homepage embedded AuthNav). Each
 * page underneath still wraps its own content in <RequireAuth>; this layout
 * only owns the two genuinely global chrome pieces (Sidebar, Header) —
 * Top Navigation and Footer are dashboard-specific, not shell-wide, per the
 * design spec's own rationale for why they're scoped to that one page.
 */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

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
