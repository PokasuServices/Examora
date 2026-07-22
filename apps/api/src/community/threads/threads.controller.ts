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
import type { PaginatedData, ThreadDetail, ThreadSummary } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toThreadDetail, toThreadSummary } from "../community.mappers";
import { AcceptAnswerDto } from "./dto/accept-answer.dto";
import { CreateThreadDto } from "./dto/create-thread.dto";
import { ListThreadsQueryDto } from "./dto/list-threads-query.dto";
import { UpdateThreadDto } from "./dto/update-thread.dto";
import { ThreadsService } from "./threads.service";

/**
 * Discussion threads and Doubt Resolution questions (ADR-0017). Gated by the
 * baseline `community:read` — browsing plus self-scoped writing, same
 * precedent as `assignment:read`/`quiz:read` (ADR-0013). Ownership (or
 * `community:moderate`) is enforced in `ThreadsService` for every mutation.
 */
@ApiTags("community: threads")
@Controller("community/threads")
@RequirePermissions("community:read")
export class ThreadsController {
  constructor(
    private readonly threadsService: ThreadsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a thread or question" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateThreadDto,
    @Req() req: Request,
  ): Promise<ThreadDetail> {
    const thread = await this.threadsService.create(actor, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.thread_created",
      entityType: "Thread",
      entityId: thread.id,
      after: { boardId: thread.boardId, type: thread.type, title: thread.title },
      ...requestAuditMeta(req),
    });
    return toThreadDetail(await this.threadsService.getDetailForViewer(actor, thread.id));
  }

  @Get()
  @ApiOperation({ summary: "List threads, optionally filtered by board/type/status/solved/author" })
  async list(
    @CurrentUser() actor: RequestUser,
    @Query() query: ListThreadsQueryDto,
  ): Promise<PaginatedData<ThreadSummary>> {
    const { items, total } = await this.threadsService.listSummaries(actor, {
      page: query.page,
      pageSize: query.pageSize,
      boardId: query.boardId,
      type: query.type,
      status: query.status,
      solved: query.solved === undefined ? undefined : query.solved === "true",
      authorId: query.authorId,
    });
    return { items: items.map(toThreadSummary), page: query.page, pageSize: query.pageSize, total };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a thread by id" })
  async findById(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ThreadDetail> {
    return toThreadDetail(await this.threadsService.getDetailForViewer(actor, id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a thread's title/body (owner or moderator)" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateThreadDto,
    @Req() req: Request,
  ): Promise<ThreadDetail> {
    await this.threadsService.update(actor, id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.thread_updated",
      entityType: "Thread",
      entityId: id,
      ...requestAuditMeta(req),
    });
    return toThreadDetail(await this.threadsService.getDetailForViewer(actor, id));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a thread (owner or moderator)" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.threadsService.remove(actor, id);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.thread_deleted",
      entityType: "Thread",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }

  @Post(":id/close")
  @ApiOperation({ summary: "Close a thread (owner or moderator)" })
  async close(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ThreadDetail> {
    await this.threadsService.setStatus(actor, id, "CLOSED");
    await this.auditService.record({
      actorId: actor.id,
      action: "community.thread_closed",
      entityType: "Thread",
      entityId: id,
      ...requestAuditMeta(req),
    });
    return toThreadDetail(await this.threadsService.getDetailForViewer(actor, id));
  }

  @Post(":id/reopen")
  @ApiOperation({ summary: "Reopen a closed thread (owner or moderator)" })
  async reopen(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ThreadDetail> {
    await this.threadsService.setStatus(actor, id, "OPEN");
    await this.auditService.record({
      actorId: actor.id,
      action: "community.thread_reopened",
      entityType: "Thread",
      entityId: id,
      ...requestAuditMeta(req),
    });
    return toThreadDetail(await this.threadsService.getDetailForViewer(actor, id));
  }

  @Post(":id/accept-answer")
  @ApiOperation({ summary: "Accept a reply as the answer to a question (owner or moderator)" })
  async acceptAnswer(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AcceptAnswerDto,
    @Req() req: Request,
  ): Promise<ThreadDetail> {
    await this.threadsService.acceptAnswer(actor, id, dto.replyId);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.answer_accepted",
      entityType: "Thread",
      entityId: id,
      after: { replyId: dto.replyId },
      ...requestAuditMeta(req),
    });
    return toThreadDetail(await this.threadsService.getDetailForViewer(actor, id));
  }

  @Post(":id/unaccept-answer")
  @ApiOperation({ summary: "Clear the accepted answer on a question (owner or moderator)" })
  async unacceptAnswer(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ThreadDetail> {
    await this.threadsService.unacceptAnswer(actor, id);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.answer_unaccepted",
      entityType: "Thread",
      entityId: id,
      ...requestAuditMeta(req),
    });
    return toThreadDetail(await this.threadsService.getDetailForViewer(actor, id));
  }
}
