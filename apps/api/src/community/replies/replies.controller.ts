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
import type { PaginatedData, Reply } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toReply } from "../community.mappers";
import { CreateReplyDto } from "./dto/create-reply.dto";
import { UpdateReplyDto } from "./dto/update-reply.dto";
import { RepliesService } from "./replies.service";

/** Replies to a thread, including nested Doubt Resolution answers (ADR-0017). */
@ApiTags("community: replies")
@Controller("community")
@RequirePermissions("community:read")
export class RepliesController {
  constructor(
    private readonly repliesService: RepliesService,
    private readonly auditService: AuditService,
  ) {}

  @Post("threads/:threadId/replies")
  @ApiOperation({ summary: "Post a reply (or nested reply) to a thread" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Param("threadId", ParseUUIDPipe) threadId: string,
    @Body() dto: CreateReplyDto,
    @Req() req: Request,
  ): Promise<Reply> {
    const reply = await this.repliesService.create(actor, threadId, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.reply_created",
      entityType: "Reply",
      entityId: reply.id,
      after: { threadId, parentReplyId: reply.parentReplyId },
      ...requestAuditMeta(req),
    });
    return toReply({ ...reply, likeCount: 0, isLikedByViewer: false, children: [] });
  }

  @Get("threads/:threadId/replies")
  @ApiOperation({ summary: "List a thread's replies as a nested tree" })
  async list(
    @CurrentUser() actor: RequestUser,
    @Param("threadId", ParseUUIDPipe) threadId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedData<Reply>> {
    const { items, total } = await this.repliesService.list(actor, threadId, {
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items: items.map(toReply), page: query.page, pageSize: query.pageSize, total };
  }

  @Patch("replies/:id")
  @ApiOperation({ summary: "Update a reply's body (owner or moderator)" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateReplyDto,
    @Req() req: Request,
  ): Promise<Reply> {
    const reply = await this.repliesService.update(actor, id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.reply_updated",
      entityType: "Reply",
      entityId: id,
      ...requestAuditMeta(req),
    });
    return toReply({ ...reply, children: [] });
  }

  @Delete("replies/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a reply (owner or moderator)" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.repliesService.remove(actor, id);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.reply_deleted",
      entityType: "Reply",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
