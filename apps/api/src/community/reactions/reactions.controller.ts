import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
  BookmarkToggleResult,
  FollowToggleResult,
  LikeToggleResult,
  PaginatedData,
  ThreadSummary,
} from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import type { RequestUser } from "../../auth/types/request-user";
import { toThreadSummary } from "../community.mappers";
import { ThreadsService } from "../threads/threads.service";
import { ReactionsService } from "./reactions.service";

/** Like/bookmark/follow toggles for threads and replies (ADR-0017). */
@ApiTags("community: reactions")
@Controller("community")
@RequirePermissions("community:read")
export class ReactionsController {
  constructor(
    private readonly reactionsService: ReactionsService,
    private readonly threadsService: ThreadsService,
  ) {}

  @Post("threads/:id/like")
  @ApiOperation({ summary: "Toggle a like on a thread" })
  async toggleThreadLike(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<LikeToggleResult> {
    return this.reactionsService.toggleLike(actor, "THREAD", id);
  }

  @Post("replies/:id/like")
  @ApiOperation({ summary: "Toggle a like on a reply" })
  async toggleReplyLike(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<LikeToggleResult> {
    return this.reactionsService.toggleLike(actor, "REPLY", id);
  }

  @Post("threads/:id/bookmark")
  @ApiOperation({ summary: "Toggle a bookmark on a thread" })
  async toggleBookmark(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BookmarkToggleResult> {
    return this.reactionsService.toggleBookmark(actor, id);
  }

  @Post("threads/:id/follow")
  @ApiOperation({ summary: "Toggle following a thread" })
  async toggleFollow(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FollowToggleResult> {
    return this.reactionsService.toggleFollow(actor, id);
  }

  @Get("bookmarks")
  @ApiOperation({ summary: "List the caller's bookmarked threads" })
  async listBookmarks(
    @CurrentUser() actor: RequestUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedData<ThreadSummary>> {
    const { threadIds, total } = await this.reactionsService.listBookmarkedThreadIds(actor, {
      page: query.page,
      pageSize: query.pageSize,
    });
    const { items } = await this.threadsService.listSummaries(actor, {
      page: 1,
      pageSize: threadIds.length,
      ids: threadIds,
    });
    const order = new Map(threadIds.map((id, index) => [id, index]));
    const sorted = [...items].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return {
      items: sorted.map(toThreadSummary),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }
}
