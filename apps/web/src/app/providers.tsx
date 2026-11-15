"use client";

import { AuthProvider } from "@examora/auth-client";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

/** Same provider stack as the TMS App.vue: theme, auth, then layout (sidebar) state. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider baseUrl={API_BASE_URL}>
        <SidebarProvider>{children}</SidebarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
