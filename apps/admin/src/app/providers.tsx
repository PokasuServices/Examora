"use client";

import { AuthProvider, useAuth } from "@examora/auth-client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { SidebarProvider } from "@/context/SidebarContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "http://localhost:3001/api/v1";

/**
 * Wraps authenticated pages in the TMS AdminLayout (sidebar + header).
 * Renders children bare while unauthenticated/loading — covers /login and
 * the brief pre-redirect window on every other route, so apps/admin's
 * existing route tree doesn't need a route group.
 */
function AuthenticatedChrome({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  if (status !== "authenticated") return <>{children}</>;
  return <AdminLayout>{children}</AdminLayout>;
}

/** Same provider stack as the TMS App.vue: auth, then layout (sidebar) state. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider baseUrl={API_BASE_URL}>
      <SidebarProvider>
        <AuthenticatedChrome>{children}</AuthenticatedChrome>
      </SidebarProvider>
    </AuthProvider>
  );
}
