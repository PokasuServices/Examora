import type { PrismaService } from "../../prisma/prisma.service";
import type { CommunityTargetType } from "@examora/types";

/**
 * Batch helpers over `CommunityLike`'s polymorphic-lite `targetType`/
 * `targetId` columns (ADR-0017) — there is no Prisma relation to count via
 * `_count`, so like counts and "did this viewer like it" are resolved with
 * explicit groupBy/findMany queries instead.
 */
export async function countLikesByTarget(
  prisma: PrismaService,
  targetType: CommunityTargetType,
  targetIds: string[],
): Promise<Map<string, number>> {
  if (targetIds.length === 0) return new Map();
  const rows = await prisma.communityLike.groupBy({
    by: ["targetId"],
    where: { targetType, targetId: { in: targetIds } },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.targetId, row._count._all]));
}

export async function getLikedTargetIdSet(
  prisma: PrismaService,
  userId: string,
  targetType: CommunityTargetType,
  targetIds: string[],
): Promise<Set<string>> {
  if (targetIds.length === 0) return new Set();
  const rows = await prisma.communityLike.findMany({
    where: { userId, targetType, targetId: { in: targetIds } },
    select: { targetId: true },
  });
  return new Set(rows.map((row) => row.targetId));
}

export async function getBookmarkedThreadIdSet(
  prisma: PrismaService,
  userId: string,
  threadIds: string[],
): Promise<Set<string>> {
  if (threadIds.length === 0) return new Set();
  const rows = await prisma.communityBookmark.findMany({
    where: { userId, threadId: { in: threadIds } },
    select: { threadId: true },
  });
  return new Set(rows.map((row) => row.threadId));
}

export async function getFollowedThreadIdSet(
  prisma: PrismaService,
  userId: string,
  threadIds: string[],
): Promise<Set<string>> {
  if (threadIds.length === 0) return new Set();
  const rows = await prisma.threadFollow.findMany({
    where: { userId, threadId: { in: threadIds } },
    select: { threadId: true },
  });
  return new Set(rows.map((row) => row.threadId));
}
