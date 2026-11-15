"use client";

import { AuthProvider } from "@examora/auth-client";
import { SidebarProvider } from "@/context/SidebarContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

/** Same provider stack as the TMS App.vue: auth, then layout (sidebar) state. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider baseUrl={API_BASE_URL}>
      <SidebarProvider>{children}</SidebarProvider>
    </AuthProvider>
  );
}
