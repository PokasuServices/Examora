import { Injectable } from "@nestjs/common";
import type { StudentAlertsSync } from "@examora/types";
import { shortName } from "../assessment/quiz-attempts/attempt-analysis.service";
import { streaks, todayInIndia } from "../daily-quiz/daily-quiz.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const IST_OFFSET_MS = 330 * 60_000;
/** Only things from this recent window become alerts. */
const LOOKBACK_DAYS = 14;
/** Never create more than this many alerts in one sync. */
const MAX_PER_SYNC = 12;
/** Streak reminders only in the evening (India time). */
const STREAK_REMINDER_HOUR_IST = 17;

interface Alert {
  key: string;
  eventType: string;
  category: string;
  title: string;
  body: string;
  url: string;
  at: Date;
}

const excerpt = (s: string, n = 110) => {
  const flat = s
    .replace(/[#*_>`~=+^[\]()!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
};

const DATE = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/**
 * Bell alerts for students, created when they open the app ("pull"): new
 * assignments, deadlines in the next 48 h, expert marks on a sketch, replies
 * to their question doubts, a Daily Quiz streak about to break, and webinars
 * starting within a day. Each alert has a stable key, so it's created once.
 */
@Injectable()
export class StudentAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async sync(userId: string, now = new Date()): Promise<StudentAlertsSync> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });
    if (!user) return { created: 0 };
    const from = new Date(
      Math.max(user.createdAt.getTime(), now.getTime() - LOOKBACK_DAYS * DAY_MS),
    );

    const existing = await this.prisma.notification.findMany({
      where: {
        userId,
        eventType: { startsWith: "student." },
        createdAt: { gte: new Date(now.getTime() - 60 * DAY_MS) },
      },
      select: { data: true },
    });
    const done = new Set(
      existing
        .map((n) => (n.data as { alertKey?: unknown } | null)?.alertKey)
        .filter((k): k is string => typeof k === "string"),
    );

    const candidates = (
      await Promise.all([
        this.assignmentAlerts(userId, from, now),
        this.sketchAlerts(userId, from),
        this.doubtAlerts(userId, from),
        this.streakAlert(userId, now),
        this.webinarAlerts(userId, now),
      ])
    )
      .flat()
      .filter((a) => !done.has(a.key))
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(-MAX_PER_SYNC);

    for (const a of candidates) {
      await this.notifications.enqueue({
        userId,
        eventType: a.eventType,
        category: a.category,
        title: a.title,
        body: a.body,
        data: { alertKey: a.key, url: a.url },
      });
    }
    return { created: candidates.length };
  }

  private async assignmentAlerts(userId: string, from: Date, now: Date): Promise<Alert[]> {
    const rows = await this.prisma.assignment.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        OR: [
          { publishedAt: { gte: from } },
          { deadline: { gt: now, lte: new Date(now.getTime() + 48 * HOUR_MS) } },
        ],
      },
      select: {
        id: true,
        title: true,
        deadline: true,
        publishedAt: true,
        submissions: {
          where: { studentId: userId },
          orderBy: { version: "desc" },
          take: 1,
          select: { status: true },
        },
      },
    });
    const alerts: Alert[] = [];
    for (const a of rows) {
      const latest = a.submissions[0]?.status;
      const open = !latest || latest === "DRAFT";
      if (!latest && a.publishedAt && a.publishedAt >= from) {
        alerts.push({
          key: `assignment-new:${a.id}`,
          eventType: "student.assignment_new",
          category: "assignments",
          title: `New assignment: ${a.title}`,
          body: a.deadline
            ? `Due ${DATE.format(a.deadline)}.`
            : "No deadline. Start when you're ready.",
          url: `/assignments/${a.id}`,
          at: a.publishedAt,
        });
      }
      if (
        open &&
        a.deadline &&
        a.deadline > now &&
        a.deadline.getTime() - now.getTime() <= 48 * HOUR_MS
      ) {
        const hours = Math.max(1, Math.round((a.deadline.getTime() - now.getTime()) / HOUR_MS));
        alerts.push({
          key: `assignment-due:${a.id}`,
          eventType: "student.assignment_due",
          category: "assignments",
          title: `Due soon: ${a.title}`,
          body: `Due in about ${hours} ${hours === 1 ? "hour" : "hours"} (${DATE.format(a.deadline)}).${latest === "DRAFT" ? " Your draft is waiting." : ""}`,
          url: `/assignments/${a.id}`,
          at: now,
        });
      }
    }
    return alerts;
  }

  private async sketchAlerts(userId: string, from: Date): Promise<Alert[]> {
    const ratings = await this.prisma.sketchVersionRating.findMany({
      where: { kind: "EXPERT", createdAt: { gte: from }, version: { work: { userId } } },
      select: {
        id: true,
        createdAt: true,
        version: {
          select: { workId: true, work: { select: { question: { select: { text: true } } } } },
        },
      },
    });
    return ratings.map((r) => ({
      key: `sketch-expert:${r.id}`,
      eventType: "student.sketch_reviewed",
      category: "learning",
      title: "An expert marked your sketch",
      body: excerpt(r.version.work.question.text),
      url: `/practice/sketches/work/${r.version.workId}`,
      at: r.createdAt,
    }));
  }

  private async doubtAlerts(userId: string, from: Date): Promise<Alert[]> {
    const replies = await this.prisma.questionDoubt.findMany({
      where: {
        createdAt: { gte: from },
        deletedAt: null,
        userId: { not: userId },
        parent: { userId, deletedAt: null },
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        questionId: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    const alerts: Alert[] = [];
    for (const r of replies) {
      alerts.push({
        key: `doubt-reply:${r.id}`,
        eventType: "student.doubt_reply",
        category: "community",
        title: `${shortName(r.user.firstName, r.user.lastName, r.user.email)} replied to your doubt`,
        body: excerpt(r.body),
        url: await this.questionLink(userId, r.questionId),
        at: r.createdAt,
      });
    }
    return alerts;
  }

  /** The student's latest report that contains the question, opened on it. */
  private async questionLink(userId: string, questionId: string): Promise<string> {
    const answer = await this.prisma.quizAttemptAnswer.findFirst({
      where: { questionId, attempt: { userId, status: { not: "IN_PROGRESS" } } },
      orderBy: { attempt: { startedAt: "desc" } },
      select: { attempt: { select: { id: true, questionSnapshot: true } } },
    });
    if (!answer) return "/notifications";
    const snapshot = answer.attempt.questionSnapshot as unknown as { questionId: string }[];
    const index = Array.isArray(snapshot)
      ? snapshot.findIndex((s) => s.questionId === questionId)
      : -1;
    return `/quizzes/attempts/${answer.attempt.id}/result?tab=answers&q=${Math.max(index, 0) + 1}`;
  }

  private async streakAlert(userId: string, now: Date): Promise<Alert[]> {
    const istHour = new Date(now.getTime() + IST_OFFSET_MS).getUTCHours();
    if (istHour < STREAK_REMINDER_HOUR_IST) return [];
    const today = todayInIndia(now);
    const played = await this.prisma.dailyQuizAttempt.findMany({
      where: {
        userId,
        catchUp: false,
        finishedAt: { not: null },
        dailyQuiz: { date: { gte: new Date(today.getTime() - 60 * DAY_MS) } },
      },
      select: { dailyQuiz: { select: { date: true } } },
    });
    const days = new Set(played.map((p) => p.dailyQuiz.date.toISOString().slice(0, 10)));
    const todayIso = today.toISOString().slice(0, 10);
    if (days.has(todayIso)) return [];
    const { current } = streaks(days, today);
    if (current < 1) return [];
    return [
      {
        key: `daily-streak:${todayIso}`,
        eventType: "student.streak_reminder",
        category: "learning",
        title: `Keep your ${current}-day streak going`,
        body: "Today's Daily Quiz takes about 2 minutes. Play before midnight!",
        url: "/daily-quiz",
        at: now,
      },
    ];
  }

  private async webinarAlerts(userId: string, now: Date): Promise<Alert[]> {
    const rows = await this.prisma.webinarRegistration.findMany({
      where: {
        userId,
        webinar: {
          published: true,
          startsAt: { gt: now, lte: new Date(now.getTime() + 24 * HOUR_MS) },
        },
      },
      select: { webinar: { select: { id: true, title: true, slug: true, startsAt: true } } },
    });
    return rows.map(({ webinar: w }) => ({
      key: `webinar-soon:${w.id}`,
      eventType: "student.webinar_soon",
      category: "events",
      title: `Starting soon: ${w.title}`,
      body: `You registered for this webinar. It starts ${DATE.format(w.startsAt)}.`,
      url: `/webinars/${w.slug}`,
      at: now,
    }));
  }
}
