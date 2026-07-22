import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { CommunityProfileSummary, PaginatedData, ReputationEventItem } from "@examora/types";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { toReputationEventItem } from "../community.mappers";
import { ReputationService } from "./reputation.service";

@ApiTags("community: reputation")
@Controller("community/reputation")
@RequirePermissions("community:read")
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  @Get(":userId")
  @ApiOperation({ summary: "Get a user's reputation summary" })
  async getProfile(
    @Param("userId", ParseUUIDPipe) userId: string,
  ): Promise<CommunityProfileSummary> {
    return this.reputationService.getProfile(userId);
  }

  @Get(":userId/events")
  @ApiOperation({ summary: "List a user's reputation ledger" })
  async listEvents(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedData<ReputationEventItem>> {
    const { items, total } = await this.reputationService.listEvents(
      userId,
      query.page,
      query.pageSize,
    );
    return {
      items: items.map(toReputationEventItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }
}
