"use client";

import * as React from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";

/**
 * Shell for every authenticated page — the TMS AdminLayout (collapsible
 * AppSidebar + AppHeader). Each page underneath still wraps its own
 * content in <RequireAuth>; this layout only owns the global chrome.
 */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
