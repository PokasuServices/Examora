"use client";

import { AuthProvider } from "@examora/auth-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider baseUrl={API_BASE_URL}>{children}</AuthProvider>;
}
