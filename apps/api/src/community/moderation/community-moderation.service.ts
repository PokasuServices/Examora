import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../auth/types/request-user";
import { RepliesService } from "../replies/replies.service";
import { ThreadsService } from "../threads/threads.service";

/**
 * Moderator-only actions on threads/replies (`community:moderate`, ADR-0017)
 * — hide/restore (quarantine, restorable) and lock/unlock/pin/unpin
 * (independent booleans, not the OPEN/CLOSED status dimension). Existence/
 * visibility checks are delegated to `ThreadsService`/`RepliesService`, which
 * already let a moderator see hidden content.
 */
@Injectable()
export class CommunityModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly threadsService: ThreadsService,
    private readonly repliesService: RepliesService,
  ) {}

  async hideThread(actor: RequestUser, threadId: string, reason: string) {
    await this.threadsService.getByIdOrThrow(actor, threadId);
    return this.prisma.thread.update({
      where: { id: threadId },
      data: { isHidden: true, hiddenReason: reason, moderatedById: actor.id },
    });
  }

  async restoreThread(actor: RequestUser, threadId: string) {
    await this.threadsService.getByIdOrThrow(actor, threadId);
    return this.prisma.thread.update({
      where: { id: threadId },
      data: { isHidden: false, hiddenReason: null, moderatedById: actor.id },
    });
  }

  async lockThread(actor: RequestUser, threadId: string) {
    await this.threadsService.getByIdOrThrow(actor, threadId);
    return this.prisma.thread.update({
      where: { id: threadId },
      data: { isLocked: true, moderatedById: actor.id },
    });
  }

  async unlockThread(actor: RequestUser, threadId: string) {
    await this.threadsService.getByIdOrThrow(actor, threadId);
    return this.prisma.thread.update({
      where: { id: threadId },
      data: { isLocked: false, moderatedById: actor.id },
    });
  }

  async pinThread(actor: RequestUser, threadId: string) {
    await this.threadsService.getByIdOrThrow(actor, threadId);
    return this.prisma.thread.update({
      where: { id: threadId },
      data: { isPinned: true, moderatedById: actor.id },
    });
  }

  async unpinThread(actor: RequestUser, threadId: string) {
    await this.threadsService.getByIdOrThrow(actor, threadId);
    return this.prisma.thread.update({
      where: { id: threadId },
      data: { isPinned: false, moderatedById: actor.id },
    });
  }

  async hideReply(actor: RequestUser, replyId: string, reason: string) {
    await this.repliesService.findByIdOrThrow(actor, replyId);
    return this.prisma.reply.update({
      where: { id: replyId },
      data: { isHidden: true, hiddenReason: reason, moderatedById: actor.id },
    });
  }

  async restoreReply(actor: RequestUser, replyId: string) {
    await this.repliesService.findByIdOrThrow(actor, replyId);
    return this.prisma.reply.update({
      where: { id: replyId },
      data: { isHidden: false, hiddenReason: null, moderatedById: actor.id },
    });
  }
}
