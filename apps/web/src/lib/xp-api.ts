"use client";

import { useAuth } from "@examora/auth-client";
import type { XpSummary } from "@examora/types";

export function useXpApi() {
  const { request } = useAuth();
  return {
    getMyXp: () => request<XpSummary>("/me/xp", { method: "GET" }),
  };
}
