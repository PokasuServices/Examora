import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { PaginatedData, ThreadSummary } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/types/request-user";
import { toThreadSummary } from "../community.mappers";
import { CommunitySearchService } from "./community-search.service";
import { SearchCommunityQueryDto } from "./dto/search-community-query.dto";

@ApiTags("community: search")
@Controller("community/search")
@RequirePermissions("community:read")
export class CommunitySearchController {
  constructor(private readonly searchService: CommunitySearchService) {}

  @Get()
  @ApiOperation({ summary: "Search forums, threads and questions by keyword" })
  async search(
    @CurrentUser() actor: RequestUser,
    @Query() query: SearchCommunityQueryDto,
  ): Promise<PaginatedData<ThreadSummary>> {
    const { items, total } = await this.searchService.search(actor, {
      q: query.q,
      boardId: query.boardId,
      type: query.type,
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items: items.map(toThreadSummary), page: query.page, pageSize: query.pageSize, total };
  }
}
