import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { ForumBoard, PaginatedData } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toForumBoard } from "../community.mappers";
import { CreateForumBoardDto } from "./dto/create-forum-board.dto";
import { ListForumsQueryDto } from "./dto/list-forums-query.dto";
import { UpdateForumBoardDto } from "./dto/update-forum-board.dto";
import { ForumBoardsService } from "./forum-boards.service";

/** Admin CRUD for forum boards (ADR-0017). */
@ApiTags("community: forums (admin)")
@Controller("admin/community/boards")
@RequirePermissions("community:manage")
export class ForumBoardsAdminController {
  constructor(
    private readonly boardsService: ForumBoardsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a forum board (community:manage)" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateForumBoardDto,
    @Req() req: Request,
  ): Promise<ForumBoard> {
    const board = await this.boardsService.create(dto, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.board_created",
      entityType: "ForumBoard",
      entityId: board.id,
      after: { title: board.title, categoryId: board.categoryId },
      ...requestAuditMeta(req),
    });
    return toForumBoard(board);
  }

  @Get()
  @ApiOperation({ summary: "List forum boards" })
  async list(@Query() query: ListForumsQueryDto): Promise<PaginatedData<ForumBoard>> {
    const { items, total } = await this.boardsService.list({
      page: query.page,
      pageSize: query.pageSize,
      categoryId: query.categoryId,
      isActive: query.isActive === undefined ? undefined : query.isActive === "true",
    });
    return { items: items.map(toForumBoard), page: query.page, pageSize: query.pageSize, total };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a forum board by id" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<ForumBoard> {
    return toForumBoard(await this.boardsService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a forum board" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateForumBoardDto,
    @Req() req: Request,
  ): Promise<ForumBoard> {
    const before = await this.boardsService.findByIdOrThrow(id);
    const updated = await this.boardsService.update(id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.board_updated",
      entityType: "ForumBoard",
      entityId: id,
      before: { title: before.title, isActive: before.isActive },
      after: { title: updated.title, isActive: updated.isActive },
      ...requestAuditMeta(req),
    });
    return toForumBoard(updated);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a forum board" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.boardsService.remove(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.board_deleted",
      entityType: "ForumBoard",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
