import type { RecommendationFeatureFlagDto, RecommendationType } from "@examora/types";

interface RawFlag {
  type: RecommendationType;
  isEnabled: boolean;
  updatedByEmail: string | null;
  updatedAt: Date | null;
}

export function toRecommendationFeatureFlagDto(flag: RawFlag): RecommendationFeatureFlagDto {
  return {
    type: flag.type,
    isEnabled: flag.isEnabled,
    updatedByEmail: flag.updatedByEmail,
    updatedAt: flag.updatedAt ? flag.updatedAt.toISOString() : null,
  };
}
