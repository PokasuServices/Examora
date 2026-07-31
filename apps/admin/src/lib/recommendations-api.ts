"use client";

import { useAuth } from "@examora/auth-client";
import type { RecommendationFeatureFlagDto, RecommendationType } from "@examora/types";

/** Typed wrappers over the recommendation feature-flag admin endpoints (recommendations:admin, ADR-0021). */
export function useRecommendationFeatureFlagsApi() {
  const { request } = useAuth();

  return {
    list: () =>
      request<RecommendationFeatureFlagDto[]>("/admin/recommendations/feature-flags", {
        method: "GET",
      }),
    setEnabled: (type: RecommendationType, isEnabled: boolean) =>
      request<RecommendationFeatureFlagDto>(`/admin/recommendations/feature-flags/${type}`, {
        method: "PATCH",
        body: { isEnabled },
      }),
  };
}
