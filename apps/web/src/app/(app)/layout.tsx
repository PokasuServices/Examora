"use client";

import * as React from "react";
import { useAuth } from "@examora/auth-client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { XpProvider } from "@/context/XpContext";
import { StaffHandoff } from "@/components/staff-handoff";
import { isStudentView, usesStaffWorkspace } from "@/lib/student-view";

/**
 * Shell for every authenticated page — the TMS AdminLayout (collapsible
 * AppSidebar + AppHeader). Students get the same shell with their own menu
 * groups (see STUDENT_MENU_GROUPS) and their XP in the header. Each page
 * underneath still wraps its own content in <RequireAuth>; this layout only
 * owns the global chrome.
 */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (usesStaffWorkspace(user)) return <StaffHandoff />;
  if (isStudentView(user)) {
    return (
      <XpProvider>
        <AdminLayout>{children}</AdminLayout>
      </XpProvider>
    );
  }
  return <AdminLayout>{children}</AdminLayout>;
}
