import { Injectable } from "@nestjs/common";
import { Prisma } from "@examora/database";
import { XP_MILESTONES, type XpSummary } from "@examora/types";
import { PrismaService } from "../prisma/prisma.service";

export interface XpAward {
  userId: string;
  amount: number;
  reason: string;
  sourceType: string;
  sourceId: string;
}

/** Builds the Rewards summary for a total. Exported for unit tests. */
export function summarizeXp(totalXp: number): XpSummary {
  const reached = XP_MILESTONES.filter((m) => totalXp >= m);
  const next = XP_MILESTONES.find((m) => totalXp < m) ?? null;
  return {
    totalXp,
    currentMilestone: reached.length > 0 ? reached[reached.length - 1]! : null,
    nextMilestone: next,
    xpToNext: next === null ? 0 : next - totalXp,
  };
}

/**
 * Student XP ledger. Awards are idempotent: the (user, reason, source) key is
 * unique, so calling award() again for the same lesson/quiz is a no-op.
 */
@Injectable()
export class XpService {
  constructor(private readonly prisma: PrismaService) {}

  async getTotal(userId: string): Promise<number> {
    const { _sum } = await this.prisma.xpEvent.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    return _sum.amount ?? 0;
  }

  async getSummary(userId: string): Promise<XpSummary> {
    return summarizeXp(await this.getTotal(userId));
  }

  /** Returns true if XP was newly awarded, false if this award already existed. */
  async award(award: XpAward): Promise<boolean> {
    if (award.amount <= 0) return false;
    try {
      await this.prisma.xpEvent.create({ data: award });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return false;
      }
      throw err;
    }
  }
}
