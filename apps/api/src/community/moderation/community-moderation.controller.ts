import { Body, Controller, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { Reply, ThreadDetail } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toReply, toThreadDetail } from "../community.mappers";
import { RepliesService } from "../replies/replies.service";
import { ThreadsService } from "../threads/threads.service";
import { CommunityModerationService } from "./community-moderation.service";
import { HideContentDto } from "./dto/hide-content.dto";

/** Moderator-only thread/reply actions (`community:moderate`, ADR-0017). */
@ApiTags("community: moderation")
@Controller("community/moderation")
@RequirePermissions("community:moderate")
export class CommunityModerationController {
  constructor(
    private readonly moderationService: CommunityModerationService,
    private readonly threadsService: ThreadsService,
    private readonly repliesService: RepliesService,
    private readonly auditService: AuditService,
  ) {}

  @Post("threads/:id/hide")
  @ApiOperation({ summary: "Hide a thread" })
  async hideThread(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: HideContentDto,
    @Req() req: Request,
  ): Promise<ThreadDetail> {
    await this.moderationService.hideThread(actor, id, dto.reason);
    await this.record(actor, req, "community.thread_hidden", "Thread", id, { reason: dto.reason });
    return toThreadDetail(await this.threadsService.getDetailForViewer(actor, id));
  }

  @Post("threads/:id/restore")
  @ApiOperation({ summary: "Restore a hidden thread" })
  async restoreThread(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ThreadDetail> {
    await this.moderationService.restoreThread(actor, id);
    await this.record(actor, req, "community.thread_restored", "Thread", id);
    return toThreadDetail(await this.threadsService.getDetailForViewer(actor, id));
  }

  @Post("threads/:id/lock")
  @ApiOperation({ summary: "Lock a thread (blocks new replies)" })
  async lockThread(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ThreadDetail> {
    await this.moderationService.lockThread(actor, id);
    await this.record(actor, req, "community.thread_locked", "Thread", id);
    return toThreadDetail(await this.threadsService.getDetailForViewer(actor, id));
  }

  @Post("threads/:id/unlock")
  @ApiOperation({ summary: "Unlock a thread" })
  async unlockThread(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ThreadDetail> {
    await this.moderationService.unlockThread(actor, id);
    await this.record(actor, req, "community.thread_unlocked", "Thread", id);
    return toThreadDetail(await this.threadsService.getDetailForViewer(actor, id));
  }

  @Post("threads/:id/pin")
  @ApiOperation({ summary: "Pin a thread" })
  async pinThread(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ThreadDetail> {
    await this.moderationService.pinThread(actor, id);
    await this.record(actor, req, "community.thread_pinned", "Thread", id);
    return toThreadDetail(await this.threadsService.getDetailForViewer(actor, id));
  }

  @Post("threads/:id/unpin")
  @ApiOperation({ summary: "Unpin a thread" })
  async unpinThread(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ThreadDetail> {
    await this.moderationService.unpinThread(actor, id);
    await this.record(actor, req, "community.thread_unpinned", "Thread", id);
    return toThreadDetail(await this.threadsService.getDetailForViewer(actor, id));
  }

  @Post("replies/:id/hide")
  @ApiOperation({ summary: "Hide a reply" })
  async hideReply(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: HideContentDto,
    @Req() req: Request,
  ): Promise<Reply> {
    await this.moderationService.hideReply(actor, id, dto.reason);
    await this.record(actor, req, "community.reply_hidden", "Reply", id, { reason: dto.reason });
    return toReply({ ...(await this.repliesService.getEnriched(actor, id)), children: [] });
  }

  @Post("replies/:id/restore")
  @ApiOperation({ summary: "Restore a hidden reply" })
  async restoreReply(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<Reply> {
    await this.moderationService.restoreReply(actor, id);
    await this.record(actor, req, "community.reply_restored", "Reply", id);
    return toReply({ ...(await this.repliesService.getEnriched(actor, id)), children: [] });
  }

  private async record(
    actor: RequestUser,
    req: Request,
    action: string,
    entityType: string,
    entityId: string,
    after?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({
      actorId: actor.id,
      action,
      entityType,
      entityId,
      ...(after ? { after } : {}),
      ...requestAuditMeta(req),
    });
  }
}
