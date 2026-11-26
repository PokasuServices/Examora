import { Injectable } from "@nestjs/common";
import type {
  CollegesDashboard,
  DashboardSeenKey,
  DiscussDashboard,
  PracticeDashboardSummary,
  RewardsDashboard,
} from "@examora/types";
import { shortName } from "../assessment/quiz-attempts/attempt-analysis.service";
import { monthStart, todayInIndia, weekStart } from "../daily-quiz/daily-quiz.service";
import { PrismaService } from "../prisma/prisma.service";
import { XP_REASON_LABEL } from "../student-profile/student-profile.service";

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;
/** On a first visit, things from this many days back count as new. */
const FIRST_VISIT_DAYS = 7;

/** Midnight in India for a UTC-midnight "IST date". */
const istMidnight = (d: Date) => new Date(d.getTime() - IST_OFFSET_MS);

const excerpt = (s: string, n = 120) => {
  const flat = s
    .replace(/[#*_>`~=+^[\]()!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
};

/**
 * Summaries shown at the top of the Practice, Discuss, Colleges and Rewards
 * tabs. Each is the logged-in student's own view; "new" means since their
 * last visit to that tab (UserSeen).
 */
@Injectable()
export class StudentDashboardsService {
  constructor(private readonly prisma: PrismaService) {}

  private async seenAt(userId: string, key: DashboardSeenKey): Promise<Date | null> {
    const row = await this.prisma.userSeen.findUnique({
      where: { userId_key: { userId, key } },
      select: { seenAt: true },
    });
    return row?.seenAt ?? null;
  }

  async markSeen(userId: string, key: DashboardSeenKey, at = new Date()): Promise<void> {
    await this.prisma.userSeen.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, seenAt: at },
      update: { seenAt: at },
    });
  }

  // ------------------------------------------------------------ practice

  /** Part B (sketching) status; the tests themselves come from the Practice overview. */
  async practice(userId: string, now = new Date()): Promise<PracticeDashboardSummary> {
    const seen = await this.seenAt(userId, "practice");
    const since = seen ?? new Date(now.getTime() - FIRST_VISIT_DAYS * DAY_MS);
    const versions = await this.prisma.sketchVersion.findMany({
      where: { deletedAt: null, work: { userId } },
      select: {
        id: true,
        workId: true,
        ratings: { select: { kind: true, raterId: true, createdAt: true } },
        work: { select: { question: { select: { text: true } } } },
      },
    });
    const expertReviews = versions
      .flatMap((v) =>
        v.ratings
          .filter((r) => r.kind === "EXPERT")
          .map((r) => ({ workId: v.workId, question: v.work.question.text, at: r.createdAt })),
      )
      .sort((a, b) => b.at.getTime() - a.at.getTime());
    // Link reviews to the paper the sketch belongs to (its first practice paper).
    const workIds = [...new Set(expertReviews.slice(0, 3).map((r) => r.workId))];
    const papers = workIds.length
      ? await this.prisma.sketchWork.findMany({
          where: { id: { in: workIds } },
          select: {
            id: true,
            question: {
              select: {
                quizQuestions: {
                  where: { quiz: { practiceCategoryId: { not: null } } },
                  select: { quizId: true },
                  take: 1,
                },
              },
            },
          },
        })
      : [];
    const paperOf = new Map(papers.map((p) => [p.id, p.question.quizQuestions[0]?.quizId ?? null]));
    return {
      lastSeenAt: seen?.toISOString() ?? null,
      sketches: {
        uploads: versions.length,
        toSelfEvaluate: versions.filter(
          (v) => !v.ratings.some((r) => r.kind === "SELF" && r.raterId === userId),
        ).length,
        waitingForExpert: versions.filter((v) => !v.ratings.some((r) => r.kind === "EXPERT"))
          .length,
        newExpertReviews: expertReviews.filter((r) => r.at > since).length,
      },
      recentReviews: expertReviews.slice(0, 3).map((r) => ({
        workId: r.workId,
        quizId: paperOf.get(r.workId) ?? null,
        question: excerpt(r.question, 90),
        at: r.at.toISOString(),
        isNew: r.at > since,
      })),
    };
  }

  // ------------------------------------------------------------ discuss

  async discuss(userId: string, now = new Date()): Promise<DiscussDashboard> {
    const seen = await this.seenAt(userId, "discuss");
    const since = seen ?? new Date(now.getTime() - FIRST_VISIT_DAYS * DAY_MS);
    const [myThreads, myReplies, myDoubts] = await Promise.all([
      this.prisma.thread.findMany({
        where: { authorId: userId, deletedAt: null },
        select: { id: true, title: true },
      }),
      this.prisma.reply.findMany({
        where: { authorId: userId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.questionDoubt.findMany({
        where: { userId, parentId: null, deletedAt: null },
        select: { id: true, _count: { select: { claps: true } } },
      }),
    ]);
    const threadIds = myThreads.map((t) => t.id);
    const titleOf = new Map(myThreads.map((t) => [t.id, t.title]));

    const [repliesOnMine, likes, doubtReplies, popular] = await Promise.all([
      threadIds.length
        ? this.prisma.reply.findMany({
            where: {
              threadId: { in: threadIds },
              authorId: { not: userId },
              deletedAt: null,
              isHidden: false,
            },
            orderBy: { createdAt: "desc" },
            select: {
              threadId: true,
              body: true,
              createdAt: true,
              author: { select: { firstName: true, lastName: true, email: true } },
            },
          })
        : Promise.resolve([]),
      this.prisma.communityLike.count({
        where: {
          OR: [
            { targetType: "THREAD", targetId: { in: threadIds } },
            { targetType: "REPLY", targetId: { in: myReplies.map((r) => r.id) } },
          ],
          userId: { not: userId },
        },
      }),
      myDoubts.length
        ? this.prisma.questionDoubt.count({
            where: {
              parentId: { in: myDoubts.map((d) => d.id) },
              userId: { not: userId },
              deletedAt: null,
              createdAt: { gt: since },
            },
          })
        : Promise.resolve(0),
      this.prisma.thread.findMany({
        where: {
          deletedAt: null,
          isHidden: false,
          createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) },
        },
        orderBy: { replies: { _count: "desc" } },
        take: 3,
        select: { id: true, title: true, _count: { select: { replies: true } } },
      }),
    ]);
    const popularLikes = popular.length
      ? await this.prisma.communityLike.groupBy({
          by: ["targetId"],
          where: { targetType: "THREAD", targetId: { in: popular.map((p) => p.id) } },
          _count: { _all: true },
        })
      : [];
    const likeOf = new Map(popularLikes.map((l) => [l.targetId, l._count._all]));
    const answered = new Set(repliesOnMine.map((r) => r.threadId));

    return {
      lastSeenAt: seen?.toISOString() ?? null,
      counts: {
        myThreads: myThreads.length,
        newReplies: repliesOnMine.filter((r) => r.createdAt > since).length,
        unanswered: myThreads.filter((t) => !answered.has(t.id)).length,
        likesReceived: likes + myDoubts.reduce((t, d) => t + d._count.claps, 0),
        myDoubts: myDoubts.length,
        newDoubtReplies: doubtReplies,
      },
      latestReplies: repliesOnMine.slice(0, 4).map((r) => ({
        threadId: r.threadId,
        threadTitle: titleOf.get(r.threadId) ?? "",
        authorName: shortName(r.author.firstName, r.author.lastName, r.author.email),
        excerpt: excerpt(r.body),
        at: r.createdAt.toISOString(),
        isNew: r.createdAt > since,
      })),
      popularThisWeek: popular.map((p) => ({
        threadId: p.id,
        title: p.title,
        replies: p._count.replies,
        likes: likeOf.get(p.id) ?? 0,
      })),
    };
  }

  // ------------------------------------------------------------ colleges

  async colleges(userId: string, now = new Date()): Promise<CollegesDashboard> {
    const [shortlist, registrations, upcoming, enquiries] = await Promise.all([
      this.prisma.collegeShortlist.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { college: { select: { id: true, name: true, slug: true, city: true } } },
      }),
      this.prisma.webinarRegistration.findMany({
        where: { userId, webinar: { published: true, endsAt: { gt: now } } },
        orderBy: { webinar: { startsAt: "asc" } },
        select: {
          webinar: { select: { id: true, title: true, slug: true, startsAt: true, joinUrl: true } },
        },
      }),
      this.prisma.webinar.count({
        where: {
          published: true,
          startsAt: { gt: now },
          registrations: { none: { userId } },
        },
      }),
      this.prisma.collegeEnquiry.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          createdAt: true,
          college: { select: { name: true, slug: true } },
        },
      }),
    ]);
    return {
      shortlisted: shortlist.map((s) => s.college),
      myWebinars: registrations.map((r) => ({
        ...r.webinar,
        startsAt: r.webinar.startsAt.toISOString(),
      })),
      otherUpcomingWebinars: upcoming,
      enquiries: enquiries.map((e) => ({
        id: e.id,
        collegeName: e.college.name,
        collegeSlug: e.college.slug,
        status: e.status,
        at: e.createdAt.toISOString(),
      })),
    };
  }

  // ------------------------------------------------------------ rewards

  async rewards(userId: string): Promise<RewardsDashboard> {
    const today = todayInIndia();
    const [all, week, month, byReason, recent] = await Promise.all([
      this.prisma.xpEvent.aggregate({ _sum: { amount: true }, where: { userId } }),
      this.prisma.xpEvent.aggregate({
        _sum: { amount: true },
        where: { userId, createdAt: { gte: istMidnight(weekStart(today)) } },
      }),
      this.prisma.xpEvent.aggregate({
        _sum: { amount: true },
        where: { userId, createdAt: { gte: istMidnight(monthStart(today)) } },
      }),
      this.prisma.xpEvent.groupBy({
        by: ["reason"],
        where: { userId },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.xpEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { reason: true, amount: true, createdAt: true },
      }),
    ]);
    const label = (r: string) => XP_REASON_LABEL[r] ?? r.replace(/_/g, " ").toLowerCase();
    return {
      total: all._sum.amount ?? 0,
      thisWeek: week._sum.amount ?? 0,
      thisMonth: month._sum.amount ?? 0,
      byReason: byReason
        .map((r) => ({
          reason: r.reason,
          label: label(r.reason),
          amount: r._sum.amount ?? 0,
          count: r._count._all,
        }))
        .filter((r) => r.amount > 0)
        .sort((a, b) => b.amount - a.amount),
      recent: recent.map((e) => ({
        reason: e.reason,
        label: label(e.reason),
        amount: e.amount,
        at: e.createdAt.toISOString(),
      })),
    };
  }
}
