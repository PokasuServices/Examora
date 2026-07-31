import { Injectable } from "@nestjs/common";
import type { RecommendationFeatureFlagDto, RecommendationType } from "@examora/types";
import { RECOMMENDATION_TYPES } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import { toRecommendationFeatureFlagDto } from "../recommendations.mappers";

/**
 * Per-recommendation-type feature flags (Sprint 11, ADR-0021 §4). Absence of
 * a row means enabled — a flag only ever exists to record a disable, so a
 * fresh install needs no seed data.
 */
@Injectable()
export class RecommendationFeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(type: RecommendationType): Promise<boolean> {
    const flag = await this.prisma.recommendationFeatureFlag.findUnique({ where: { type } });
    return flag?.isEnabled ?? true;
  }

  /** All types, defaulting to enabled for any type without a row. */
  async listAll(): Promise<RecommendationFeatureFlagDto[]> {
    const flags = await this.prisma.recommendationFeatureFlag.findMany({
      include: { updatedBy: { select: { email: true } } },
    });
    const byType = new Map(flags.map((f) => [f.type, f]));
    return RECOMMENDATION_TYPES.map((type) => {
      const flag = byType.get(type);
      return toRecommendationFeatureFlagDto({
        type,
        isEnabled: flag?.isEnabled ?? true,
        updatedByEmail: flag?.updatedBy?.email ?? null,
        updatedAt: flag?.updatedAt ?? null,
      });
    });
  }

  async setEnabled(
    type: RecommendationType,
    isEnabled: boolean,
    updatedById: string,
  ): Promise<RecommendationFeatureFlagDto> {
    const flag = await this.prisma.recommendationFeatureFlag.upsert({
      where: { type },
      update: { isEnabled, updatedById },
      create: { type, isEnabled, updatedById },
      include: { updatedBy: { select: { email: true } } },
    });
    return toRecommendationFeatureFlagDto({
      type: flag.type,
      isEnabled: flag.isEnabled,
      updatedByEmail: flag.updatedBy?.email ?? null,
      updatedAt: flag.updatedAt,
    });
  }
}
