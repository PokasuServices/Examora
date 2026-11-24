import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { TestShareInfo, TestShareVisitResult } from "@examora/types";
import { XpService } from "../gamification/xp.service";
import { PrismaService } from "../prisma/prisma.service";

/** XP the sharer earns for each different student who opens the link. */
export const SHARE_XP_PER_VISITOR = 5;
/** Rewarded visitors per share link (later visitors are still counted, without XP). */
export const SHARE_MAX_REWARDED = 10;

/**
 * "Share this test": a per-student link for a practice test. The sharer earns
 * XP when other signed-in students open it, once per person and capped, so it
 * can't be farmed by reloading.
 */
@Injectable()
export class TestSharesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly xp: XpService,
  ) {}

  private async info(shareId: string | null, code: string | null): Promise<TestShareInfo> {
    if (!shareId || !code) {
      return {
        code: null,
        visitors: 0,
        xpEarned: 0,
        xpPerVisitor: SHARE_XP_PER_VISITOR,
        maxRewarded: SHARE_MAX_REWARDED,
      };
    }
    const visitors = await this.prisma.testShareVisit.count({ where: { shareId } });
    return {
      code,
      visitors,
      xpEarned: Math.min(visitors, SHARE_MAX_REWARDED) * SHARE_XP_PER_VISITOR,
      xpPerVisitor: SHARE_XP_PER_VISITOR,
      maxRewarded: SHARE_MAX_REWARDED,
    };
  }

  private async assertPracticeTest(quizId: string): Promise<void> {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: quizId, deletedAt: null, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!quiz) throw new NotFoundException("Test not found");
  }

  async get(userId: string, quizId: string): Promise<TestShareInfo> {
    const share = await this.prisma.testShare.findUnique({
      where: { sharerId_quizId: { sharerId: userId, quizId } },
      select: { id: true, code: true },
    });
    return this.info(share?.id ?? null, share?.code ?? null);
  }

  /** Creates (or returns) the caller's share link for a test. */
  async create(userId: string, quizId: string): Promise<TestShareInfo> {
    await this.assertPracticeTest(quizId);
    const share = await this.prisma.testShare.upsert({
      where: { sharerId_quizId: { sharerId: userId, quizId } },
      create: { sharerId: userId, quizId, code: randomBytes(8).toString("base64url") },
      update: {},
      select: { id: true, code: true },
    });
    return this.info(share.id, share.code);
  }

  /** Someone opened a share link. Rewards the sharer once per new visitor, up to the cap. */
  async visit(visitorId: string, code: string): Promise<TestShareVisitResult> {
    const share = await this.prisma.testShare.findUnique({
      where: { code },
      select: { id: true, sharerId: true, quizId: true },
    });
    if (!share) throw new NotFoundException("This share link isn't valid");
    if (share.sharerId === visitorId) {
      return { quizId: share.quizId, counted: false };
    }
    const already = await this.prisma.testShareVisit.findUnique({
      where: { shareId_visitorId: { shareId: share.id, visitorId } },
      select: { id: true },
    });
    if (already) return { quizId: share.quizId, counted: false };

    const visit = await this.prisma.testShareVisit
      .create({ data: { shareId: share.id, visitorId }, select: { id: true } })
      .catch((err: { code?: string }) => {
        if (err.code === "P2002") return null;
        throw err;
      });
    if (!visit) return { quizId: share.quizId, counted: false };

    const rank = await this.prisma.testShareVisit.count({ where: { shareId: share.id } });
    if (rank <= SHARE_MAX_REWARDED) {
      await this.xp.award({
        userId: share.sharerId,
        amount: SHARE_XP_PER_VISITOR,
        reason: "TEST_SHARED",
        sourceType: "TestShareVisit",
        sourceId: visit.id,
      });
    }
    return { quizId: share.quizId, counted: true };
  }
}

/** Share codes are 11 url-safe characters (8 random bytes). */
export function assertShareCode(code: string): string {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(code)) throw new BadRequestException("Invalid share code");
  return code;
}
