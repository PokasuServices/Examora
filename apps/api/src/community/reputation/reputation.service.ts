import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Thin, auditable reputation foundation (ADR-0017) — no levels, badges, or
 * decay this sprint. `CommunityProfile.reputationPoints` is a denormalized
 * running total; every change is also recorded in the append-only
 * `ReputationEvent` ledger, mirroring `AuditLog`'s shape for disputable
 * actions elsewhere in this codebase.
 */
@Injectable()
export class ReputationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Awards (or deducts, if `points` is negative) reputation and logs why. */
  async award(userId: string, points: number, reason: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.communityProfile.upsert({
        where: { userId },
        create: { userId, reputationPoints: points },
        update: { reputationPoints: { increment: points } },
      }),
      this.prisma.reputationEvent.create({ data: { userId, points, reason } }),
    ]);
  }

  async getProfile(userId: string): Promise<{ userId: string; reputationPoints: number }> {
    const profile = await this.prisma.communityProfile.findUnique({ where: { userId } });
    return { userId, reputationPoints: profile?.reputationPoints ?? 0 };
  }

  async listEvents(userId: string, page: number, pageSize: number) {
    const where = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.reputationEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.reputationEvent.count({ where }),
    ]);
    return { items, total };
  }
}
