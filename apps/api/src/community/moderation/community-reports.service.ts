import { Injectable, NotFoundException } from "@nestjs/common";
import type { CommunityReportStatus, CommunityTargetType } from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../../auth/types/request-user";
import { RepliesService } from "../replies/replies.service";
import { ThreadsService } from "../threads/threads.service";

const REPORT_INCLUDE = {
  reporter: { select: { email: true } },
  reviewedBy: { select: { email: true } },
} as const;

/** The report queue (ADR-0017) — any authenticated user may report; only `community:moderate` reviews. */
@Injectable()
export class CommunityReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly threadsService: ThreadsService,
    private readonly repliesService: RepliesService,
  ) {}

  async create(
    actor: RequestUser,
    targetType: CommunityTargetType,
    targetId: string,
    reason: string,
  ) {
    if (targetType === "THREAD") {
      await this.threadsService.getByIdOrThrow(actor, targetId);
    } else {
      await this.repliesService.findByIdOrThrow(actor, targetId);
    }

    return this.prisma.communityReport.create({
      data: { reporterId: actor.id, targetType, targetId, reason },
      include: REPORT_INCLUDE,
    });
  }

  async listQueue(params: { page: number; pageSize: number; status?: CommunityReportStatus }) {
    const where = { ...(params.status ? { status: params.status } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.communityReport.findMany({
        where,
        include: REPORT_INCLUDE,
        orderBy: { createdAt: "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.communityReport.count({ where }),
    ]);

    const previews = await this.resolvePreviews(items);
    return {
      items: items.map((item) => ({ ...item, targetPreview: previews.get(item.id) ?? null })),
      total,
    };
  }

  async review(actor: RequestUser, reportId: string, status: "REVIEWED" | "DISMISSED") {
    const report = await this.prisma.communityReport.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException("Report not found");
    }

    return this.prisma.communityReport.update({
      where: { id: reportId },
      data: { status, reviewedById: actor.id, reviewedAt: new Date() },
      include: REPORT_INCLUDE,
    });
  }

  private async resolvePreviews(
    reports: Array<{ id: string; targetType: CommunityTargetType; targetId: string }>,
  ): Promise<Map<string, string>> {
    const threadIds = reports.filter((r) => r.targetType === "THREAD").map((r) => r.targetId);
    const replyIds = reports.filter((r) => r.targetType === "REPLY").map((r) => r.targetId);

    const [threads, replies] = await Promise.all([
      threadIds.length
        ? this.prisma.thread.findMany({
            where: { id: { in: threadIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      replyIds.length
        ? this.prisma.reply.findMany({
            where: { id: { in: replyIds } },
            select: { id: true, body: true },
          })
        : Promise.resolve([]),
    ]);

    const previewByTargetId = new Map<string, string>();
    for (const thread of threads) previewByTargetId.set(thread.id, thread.title);
    for (const reply of replies) previewByTargetId.set(reply.id, reply.body.slice(0, 200));

    const previewByReportId = new Map<string, string>();
    for (const report of reports) {
      const preview = previewByTargetId.get(report.targetId);
      if (preview) previewByReportId.set(report.id, preview);
    }
    return previewByReportId;
  }
}
