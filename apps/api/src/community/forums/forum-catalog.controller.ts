import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ForumBoard, ForumCategory, PaginatedData } from "@examora/types";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { toForumBoard, toForumCategory } from "../community.mappers";
import { ListForumsQueryDto } from "./dto/list-forums-query.dto";
import { ForumBoardsService } from "./forum-boards.service";
import { ForumCategoriesService } from "./forum-categories.service";

/**
 * Student-facing forum browsing — active categories/boards only, gated by
 * the baseline `community:read` (ADR-0017), mirroring Content's
 * Catalog-vs-Admin split.
 */
@ApiTags("community: forums")
@Controller("community")
@RequirePermissions("community:read")
export class ForumCatalogController {
  constructor(
    private readonly categoriesService: ForumCategoriesService,
    private readonly boardsService: ForumBoardsService,
  ) {}

  @Get("categories")
  @ApiOperation({ summary: "List active forum categories" })
  async listCategories(@Query() query: PaginationQueryDto): Promise<PaginatedData<ForumCategory>> {
    const { items, total } = await this.categoriesService.list({
      page: query.page,
      pageSize: query.pageSize,
      isActive: true,
    });
    return { items: items.map(toForumCategory), page: query.page, pageSize: query.pageSize, total };
  }

  @Get("categories/:id")
  @ApiOperation({ summary: "Get a forum category by id" })
  async getCategory(@Param("id", ParseUUIDPipe) id: string): Promise<ForumCategory> {
    return toForumCategory(await this.categoriesService.findByIdOrThrow(id));
  }

  @Get("boards")
  @ApiOperation({ summary: "List active forum boards, optionally by category" })
  async listBoards(@Query() query: ListForumsQueryDto): Promise<PaginatedData<ForumBoard>> {
    const { items, total } = await this.boardsService.list({
      page: query.page,
      pageSize: query.pageSize,
      categoryId: query.categoryId,
      isActive: true,
    });
    return { items: items.map(toForumBoard), page: query.page, pageSize: query.pageSize, total };
  }

  @Get("boards/:id")
  @ApiOperation({ summary: "Get a forum board by id" })
  async getBoard(@Param("id", ParseUUIDPipe) id: string): Promise<ForumBoard> {
    return toForumBoard(await this.boardsService.findByIdOrThrow(id));
  }
}
