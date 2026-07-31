import { Body, Controller, Get, Param, ParseEnumPipe, Patch, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import {
  RECOMMENDATION_TYPES,
  type RecommendationFeatureFlagDto,
  type RecommendationType,
} from "@examora/types";
import { AuditService } from "../../audit/audit.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import type { RequestUser } from "../../auth/types/request-user";
import { SetRecommendationFeatureFlagDto } from "../dto/set-recommendation-feature-flag.dto";
import { RecommendationFeatureFlagsService } from "./recommendation-feature-flags.service";

/** Per-recommendation-type kill switch (recommendations:admin, ADR-0021 §4). */
@ApiTags("recommendations (admin)")
@Controller("admin/recommendations/feature-flags")
@RequirePermissions("recommendations:admin")
export class RecommendationFeatureFlagsController {
  constructor(
    private readonly featureFlagsService: RecommendationFeatureFlagsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List every recommendation type's feature flag" })
  async list(): Promise<RecommendationFeatureFlagDto[]> {
    return this.featureFlagsService.listAll();
  }

  @Patch(":type")
  @ApiOperation({ summary: "Enable or disable a recommendation type platform-wide" })
  async setEnabled(
    @CurrentUser() actor: RequestUser,
    @Param("type", new ParseEnumPipe(RECOMMENDATION_TYPES)) type: RecommendationType,
    @Body() dto: SetRecommendationFeatureFlagDto,
    @Req() req: Request,
  ): Promise<RecommendationFeatureFlagDto> {
    const flag = await this.featureFlagsService.setEnabled(type, dto.isEnabled, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: dto.isEnabled
        ? "recommendations.feature_flag_enabled"
        : "recommendations.feature_flag_disabled",
      entityType: "RecommendationFeatureFlag",
      entityId: type,
      ...requestAuditMeta(req),
    });
    return flag;
  }
}
