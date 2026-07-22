import { Injectable } from "@nestjs/common";
import type { Prisma } from "@examora/database";
import type { ThreadType } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../auth/types/request-user";
import { CommunityAccessService } from "../common/community-access.service";
import { countLikesByTarget } from "../common/community-reactions.util";
import { THREAD_LIST_INCLUDE } from "../threads/threads.service";

/**
 * Keyword search over forums/threads/questions (ADR-0017). MVP: Prisma
 * `contains`/`mode: "insensitive"` — no full-text index or relevance ranking
 * yet (TD-031); adequate for the sprint's scope at current content volume.
 */
@Injectable()
export class CommunitySearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: CommunityAccessService,
  ) {}

  async search(
    actor: RequestUser,
    params: { q: string; boardId?: string; type?: ThreadType; page: number; pageSize: number },
  ) {
    const isModerator = await this.accessService.isModerator(actor);
    const where: Prisma.ThreadWhereInput = {
      deletedAt: null,
      ...(isModerator ? {} : { isHidden: false }),
      ...(params.boardId ? { boardId: params.boardId } : {}),
      ...(params.type ? { type: params.type } : {}),
      OR: [
        { title: { contains: params.q, mode: "insensitive" } },
        { body: { contains: params.q, mode: "insensitive" } },
      ],
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.thread.findMany({
        where,
        include: THREAD_LIST_INCLUDE,
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.thread.count({ where }),
    ]);

    const likeCounts = await countLikesByTarget(
      this.prisma,
      "THREAD",
      items.map((item) => item.id),
    );
    return {
      items: items.map((item) => ({ ...item, likeCount: likeCounts.get(item.id) ?? 0 })),
      total,
    };
  }
}
