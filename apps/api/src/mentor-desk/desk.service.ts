import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  SHOUTOUTS_PER_WEEK,
  type AtRiskStudent,
  type BatchProgressView,
  type MentorDoubtItem,
  type MentorDoubtThread,
  type MentorTodayView,
  type MentorWorkloadView,
  type ReviewInbox,
  type ReviewInboxItem,
} from "@examora/types";
import type { RequestUser } from "../auth/types/request-user";
import { PrismaService } from "../prisma/prisma.service";
import { StaffScopeService, type StaffScope } from "../staff/staff-scope.service";
import { AttendanceService } from "./attendance.service";
import { DeskNotifier } from "./desk-notifier.service";
import {
  USER_NAME_SELECT,
  addDays,
  hoursSince,
  isoDay,
  minutesNowIndia,
  person,
  personName,
  todayIndia,
  toMinutes,
} from "./desk-util";
import { InsightsService } from "./insights.service";

const FINISHED = ["SUBMITTED", "AUTO_SUBMITTED"] as const;
const WAITING_SUBMISSION = ["SUBMITTED", "UNDER_REVIEW"] as const;

@Injectable()
export class DeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: StaffScopeService,
    private readonly attendance: AttendanceService,
    private readonly insights: InsightsService,
    private readonly notify: DeskNotifier,
  ) {}

  /** A mentor's own scope; administrators see every active batch here. */
  async deskScope(actor: RequestUser): Promise<StaffScope> {
    const s = await this.scope.scopeFor(actor);
    if (s) return s;
    const cohorts = await this.prisma.cohort.findMany({
      where: { isActive: true },
      select: { id: true, courseId: true, members: { select: { userId: true } } },
    });
    return {
      userId: actor.id,
      cohortIds: cohorts.map((c) => c.id),
      courseIds: [...new Set(cohorts.map((c) => c.courseId).filter((x): x is string => !!x))],
      studentIds: [...new Set(cohorts.flatMap((c) => c.members.map((m) => m.userId)))],
    };
  }

  // ------------------------------------------------------------ today

  async today(actor: RequestUser): Promise<MentorTodayView> {
    const s = await this.deskScope(actor);
    const today = todayIndia();
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: USER_NAME_SELECT,
    });
    await Promise.all(
      s.cohortIds.map((id) =>
        this.attendance.ensureSessions(id, addDays(today, -7), addDays(today, 7)),
      ),
    );

    const sessions = await this.prisma.classSession.findMany({
      where: {
        cohortId: { in: s.cohortIds },
        date: { gte: addDays(today, -7), lte: today },
        cancelled: false,
      },
      orderBy: [{ date: "asc" }, { start: "asc" }],
      select: {
        id: true,
        cohortId: true,
        date: true,
        start: true,
        end: true,
        mode: true,
        takenAt: true,
        cohort: {
          select: {
            name: true,
            location: true,
            meetingUrl: true,
            _count: { select: { members: true } },
          },
        },
        records: { select: { status: true } },
      },
    });
    const now = minutesNowIndia();
    const todays = sessions.filter((x) => x.date.getTime() === today.getTime());
    const unmarked = sessions.filter(
      (x) => !x.takenAt && (x.date < today || toMinutes(x.end) <= now),
    );

    const [sketches, revisions, assignments, oldestSketch, oldestSub] = await Promise.all([
      this.prisma.quizAttemptAnswer.count({
        where: {
          uploadAssetId: { not: null },
          attempt: { status: { in: [...FINISHED] }, userId: { in: s.studentIds } },
          OR: [{ sketchReview: null }, { sketchReview: { expertReviewedAt: null } }],
        },
      }),
      this.prisma.sketchVersion.count({
        where: {
          answerId: null,
          deletedAt: null,
          work: { userId: { in: s.studentIds } },
          ratings: { none: { kind: "EXPERT" } },
        },
      }),
      this.prisma.assignmentSubmission.count({
        where: { reviewerId: actor.id, status: { in: [...WAITING_SUBMISSION] } },
      }),
      this.prisma.quizAttemptAnswer.findFirst({
        where: {
          uploadAssetId: { not: null },
          attempt: { status: { in: [...FINISHED] }, userId: { in: s.studentIds } },
          OR: [{ sketchReview: null }, { sketchReview: { expertReviewedAt: null } }],
        },
        orderBy: { answeredAt: "asc" },
        select: { answeredAt: true },
      }),
      this.prisma.assignmentSubmission.findFirst({
        where: { reviewerId: actor.id, status: { in: [...WAITING_SUBMISSION] } },
        orderBy: { submittedAt: "asc" },
        select: { submittedAt: true },
      }),
    ]);
    const oldest = [oldestSketch?.answeredAt, oldestSub?.submittedAt]
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    const doubtWhere = this.doubtWhere(s);
    const [openDoubts, newDoubts] = await Promise.all([
      this.prisma.questionDoubt.count({ where: { ...doubtWhere, resolvedAt: null } }),
      this.prisma.questionDoubt.count({
        where: { ...doubtWhere, createdAt: { gte: addDays(today, 0) } },
      }),
    ]);

    const courses = await this.prisma.course.findMany({
      where: { id: { in: s.courseIds } },
      select: { id: true, title: true },
    });
    const schedules = await this.prisma.dailyQuizSchedule.findMany({
      where: { courseId: { in: s.courseIds }, date: { gte: today, lte: addDays(today, 6) } },
      select: { courseId: true, date: true },
    });
    const quizGaps = courses
      .map((c) => {
        const have = new Set(
          schedules.filter((x) => x.courseId === c.id).map((x) => isoDay(x.date)),
        );
        const emptyDays = Array.from({ length: 7 }, (_, i) => isoDay(addDays(today, i))).filter(
          (d) => !have.has(d),
        );
        return { courseId: c.id, courseTitle: c.title, emptyDays };
      })
      .filter((g) => g.emptyDays.length > 0);

    const [returnedReports, returnedRequests, shoutoutsWeek] = await Promise.all([
      this.prisma.progressReport.count({ where: { mentorId: actor.id, status: "RETURNED" } }),
      this.prisma.staffRequest.count({
        where: {
          requestedById: actor.id,
          status: "REJECTED",
          decidedAt: { gte: addDays(today, -14) },
        },
      }),
      this.prisma.mentorShoutout.count({
        where: { mentorId: actor.id, createdAt: { gte: addDays(new Date(), -7) } },
      }),
    ]);

    const batchesRaw = await this.prisma.cohort.findMany({
      where: { id: { in: s.cohortIds } },
      select: {
        id: true,
        name: true,
        course: { select: { title: true } },
        _count: { select: { members: true } },
        mentors: { where: { mentorId: actor.id }, select: { role: true, endsOn: true } },
      },
      orderBy: { name: "asc" },
    });
    const batches = [];
    for (const b of batchesRaw) {
      const grid = await this.attendance.grid(b.id, addDays(today, -30), today);
      batches.push({
        id: b.id,
        name: b.name,
        courseTitle: b.course?.title ?? null,
        students: b._count.members,
        percent: grid.percent,
        role: (b.mentors[0]?.role === "COVER" ? "COVER" : "PRIMARY") as "PRIMARY" | "COVER",
        coverEndsOn: b.mentors[0]?.endsOn ? isoDay(b.mentors[0].endsOn) : null,
      });
    }

    return {
      mentorName: personName(me),
      date: isoDay(today),
      classes: todays.map((x) => ({
        sessionId: x.id,
        cohortId: x.cohortId,
        cohortName: x.cohort.name,
        start: x.start,
        end: x.end,
        mode: x.mode === "ONLINE" ? "ONLINE" : "OFFLINE",
        location: x.cohort.location,
        meetingUrl: x.cohort.meetingUrl,
        taken: !!x.takenAt,
        present: x.takenAt
          ? x.records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length
          : null,
        total: x.cohort._count.members,
      })),
      unmarked: unmarked.map((x) => ({
        sessionId: x.id,
        cohortName: x.cohort.name,
        date: isoDay(x.date),
        start: x.start,
      })),
      reviews: { sketches, revisions, assignments, oldestHours: hoursSince(oldest) },
      doubts: { open: openDoubts, newToday: newDoubts },
      quizGaps,
      returned: { reports: returnedReports, requests: returnedRequests },
      atRisk: await this.atRisk(s, 8),
      batches,
      shoutoutsLeft: Math.max(0, SHOUTOUTS_PER_WEEK - shoutoutsWeek),
    };
  }

  /** Students who need attention: low/absent attendance, inactivity, missed work, falling scores. */
  async atRisk(s: StaffScope, limit = 50): Promise<AtRiskStudent[]> {
    const today = todayIndia();
    const stats = await this.insights.stats(s.studentIds, addDays(today, -30), today, s.courseIds);
    const users = await this.prisma.user.findMany({
      where: { id: { in: s.studentIds } },
      select: {
        ...USER_NAME_SELECT,
        cohortMemberships: {
          where: { cohortId: { in: s.cohortIds } },
          select: { cohort: { select: { name: true } } },
        },
      },
    });
    const out: AtRiskStudent[] = [];
    for (const u of users) {
      const st = stats.get(u.id);
      if (!st) continue;
      const reasons: string[] = [];
      if (st.lastThreeAbsent) reasons.push("Absent for the last 3 classes");
      else if (st.attendancePercent !== null && st.attendancePercent < 75) {
        reasons.push(`Attendance ${st.attendancePercent}% this month`);
      }
      if (!st.lastActiveAt || st.lastActiveAt < addDays(new Date(), -7))
        reasons.push("No study activity for 7+ days");
      if (st.assignmentsMissing > 0) {
        reasons.push(
          `${st.assignmentsMissing} assignment${st.assignmentsMissing > 1 ? "s" : ""} missed`,
        );
      }
      if (st.avgQuizPercent !== null && st.avgQuizPercent < 40)
        reasons.push(`Quiz average ${st.avgQuizPercent}%`);
      if (reasons.length) {
        out.push({
          userId: u.id,
          name: personName(u),
          email: u.email,
          cohortName: u.cohortMemberships[0]?.cohort.name ?? "",
          reasons,
        });
      }
    }
    return out.sort((a, b) => b.reasons.length - a.reasons.length).slice(0, limit);
  }

  // ------------------------------------------------------------ review inbox

  async reviews(actor: RequestUser): Promise<ReviewInbox> {
    const s = await this.deskScope(actor);
    const now = new Date();
    const [sketches, revisions, subs, done, doneSubs] = await Promise.all([
      this.prisma.quizAttemptAnswer.findMany({
        where: {
          uploadAssetId: { not: null },
          attempt: { status: { in: [...FINISHED] }, userId: { in: s.studentIds } },
          OR: [{ sketchReview: null }, { sketchReview: { expertReviewedAt: null } }],
        },
        orderBy: { answeredAt: "asc" },
        take: 100,
        select: {
          id: true,
          answeredAt: true,
          question: { select: { text: true } },
          attempt: {
            select: {
              submittedAt: true,
              quiz: { select: { title: true } },
              user: { select: USER_NAME_SELECT },
            },
          },
        },
      }),
      this.prisma.sketchVersion.findMany({
        where: {
          answerId: null,
          deletedAt: null,
          work: { userId: { in: s.studentIds } },
          ratings: { none: { kind: "EXPERT" } },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: {
          id: true,
          kind: true,
          createdAt: true,
          work: {
            select: { question: { select: { text: true } }, user: { select: USER_NAME_SELECT } },
          },
        },
      }),
      this.prisma.assignmentSubmission.findMany({
        where: { reviewerId: actor.id, status: { in: [...WAITING_SUBMISSION] } },
        orderBy: { submittedAt: "asc" },
        take: 100,
        select: {
          id: true,
          version: true,
          submittedAt: true,
          assignment: { select: { title: true, deadline: true } },
          student: { select: USER_NAME_SELECT },
        },
      }),
      this.prisma.sketchReview.findMany({
        where: { expertId: actor.id, expertReviewedAt: { gte: addDays(now, -30) } },
        select: { expertReviewedAt: true, answer: { select: { answeredAt: true } } },
      }),
      this.prisma.assignmentReview.findMany({
        where: { reviewerId: actor.id, publishedAt: { gte: addDays(now, -30) } },
        select: { publishedAt: true, submission: { select: { submittedAt: true } } },
      }),
    ]);
    const trim = (t: string) => (t.length > 90 ? `${t.slice(0, 87)}…` : t);
    const items: ReviewInboxItem[] = [
      ...sketches.map((a) => ({
        kind: "SKETCH" as const,
        id: a.id,
        student: person(a.attempt.user),
        title: a.attempt.quiz.title,
        detail: trim(a.question.text),
        submittedAt: (a.attempt.submittedAt ?? a.answeredAt)?.toISOString() ?? null,
        waitingHours: hoursSince(a.attempt.submittedAt ?? a.answeredAt, now),
        href: "/assessment/sketches",
      })),
      ...revisions.map((v) => ({
        kind: "REVISION" as const,
        id: v.id,
        student: person(v.work.user),
        title: v.kind === "REVISION" ? "Sketch revision" : "Part B sketch",
        detail: trim(v.work.question.text),
        submittedAt: v.createdAt.toISOString(),
        waitingHours: hoursSince(v.createdAt, now),
        href: "/assessment/sketches?tab=revisions",
      })),
      ...subs.map((x) => ({
        kind: "ASSIGNMENT" as const,
        id: x.id,
        student: person(x.student),
        title: x.assignment.title,
        detail: x.version > 1 ? `Resubmission v${x.version}` : null,
        submittedAt: x.submittedAt?.toISOString() ?? null,
        waitingHours: hoursSince(x.submittedAt, now),
        href: `/assignments/reviewer/${x.id}`,
      })),
    ].sort((a, b) => (b.waitingHours ?? 0) - (a.waitingHours ?? 0));
    const turn = [
      ...done.map((d) =>
        d.answer.answeredAt && d.expertReviewedAt
          ? d.expertReviewedAt.getTime() - d.answer.answeredAt.getTime()
          : null,
      ),
      ...doneSubs.map((d) =>
        d.submission.submittedAt && d.publishedAt
          ? d.publishedAt.getTime() - d.submission.submittedAt.getTime()
          : null,
      ),
    ].filter((x): x is number => x !== null && x >= 0);
    return {
      items,
      counts: { SKETCH: sketches.length, REVISION: revisions.length, ASSIGNMENT: subs.length },
      doneLast30: done.length + doneSubs.length,
      avgTurnaroundHours: turn.length
        ? Math.round(turn.reduce((a, b) => a + b, 0) / turn.length / 3_600_000)
        : null,
    };
  }

  // ------------------------------------------------------------ doubts

  private doubtWhere(s: StaffScope) {
    const inCourses = { in: s.courseIds };
    return {
      parentId: null,
      deletedAt: null,
      kind: "DOUBT" as const,
      question: {
        OR: [{ subject: { courseId: inCourses } }, { topic: { subject: { courseId: inCourses } } }],
      },
    };
  }

  private async staffIds(ids: string[]): Promise<Set<string>> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId: { in: ids }, role: { name: { in: ["MENTOR", "ADMINISTRATOR"] } } },
      select: { userId: true },
    });
    return new Set(rows.map((r) => r.userId));
  }

  async doubts(
    actor: RequestUser,
    q: { status?: "open" | "resolved" | "all"; scope?: "batches" | "course" },
  ): Promise<MentorDoubtItem[]> {
    const s = await this.deskScope(actor);
    const rows = await this.prisma.questionDoubt.findMany({
      where: {
        ...this.doubtWhere(s),
        ...(q.status === "resolved"
          ? { resolvedAt: { not: null } }
          : q.status === "all"
            ? {}
            : { resolvedAt: null }),
        ...(q.scope === "batches" ? { userId: { in: s.studentIds } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        questionId: true,
        body: true,
        createdAt: true,
        resolvedAt: true,
        user: { select: USER_NAME_SELECT },
        replies: { where: { deletedAt: null }, select: { userId: true } },
        question: {
          select: {
            text: true,
            subject: { select: { course: { select: { title: true } } } },
            topic: { select: { subject: { select: { course: { select: { title: true } } } } } },
          },
        },
      },
    });
    const staff = await this.staffIds([
      ...new Set(rows.flatMap((r) => r.replies.map((x) => x.userId))),
    ]);
    const mine = new Set(s.studentIds);
    return rows
      .map((r) => ({
        id: r.id,
        questionId: r.questionId,
        questionText: r.question.text,
        courseTitle:
          r.question.subject?.course.title ?? r.question.topic?.subject.course.title ?? null,
        author: person(r.user),
        inMyBatch: mine.has(r.user.id),
        body: r.body,
        createdAt: r.createdAt.toISOString(),
        replies: r.replies.length,
        answeredByStaff: r.replies.some((x) => staff.has(x.userId)),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
      }))
      .sort(
        (a, b) =>
          Number(b.inMyBatch) - Number(a.inMyBatch) ||
          Number(a.answeredByStaff) - Number(b.answeredByStaff),
      );
  }

  private async doubtOrThrow(actor: RequestUser, id: string) {
    const s = await this.deskScope(actor);
    const d = await this.prisma.questionDoubt.findFirst({
      where: { id, ...this.doubtWhere(s) },
      select: { id: true },
    });
    if (!d) throw new NotFoundException("Doubt not found");
    return s;
  }

  async doubt(actor: RequestUser, id: string): Promise<MentorDoubtThread> {
    await this.doubtOrThrow(actor, id);
    const all = await this.doubts(actor, { status: "all" });
    const item = all.find((d) => d.id === id);
    if (!item) throw new NotFoundException("Doubt not found");
    const row = await this.prisma.questionDoubt.findUniqueOrThrow({
      where: { id },
      select: {
        question: { select: { imageUrl: true } },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          select: { id: true, body: true, createdAt: true, user: { select: USER_NAME_SELECT } },
        },
      },
    });
    const staff = await this.staffIds(row.replies.map((r) => r.user.id));
    return {
      doubt: item,
      questionImageUrl: row.question.imageUrl,
      replies: row.replies.map((r) => ({
        id: r.id,
        author: person(r.user),
        isStaff: staff.has(r.user.id),
        body: r.body,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async replyDoubt(
    actor: RequestUser,
    id: string,
    body: string,
    resolve: boolean,
  ): Promise<MentorDoubtThread> {
    await this.doubtOrThrow(actor, id);
    const text = body.trim();
    if (text.length < 2) throw new BadRequestException("Write an answer");
    const parent = await this.prisma.questionDoubt.findUniqueOrThrow({
      where: { id },
      select: { questionId: true, userId: true },
    });
    await this.prisma.questionDoubt.create({
      data: { questionId: parent.questionId, userId: actor.id, parentId: id, body: text },
    });
    if (resolve) {
      await this.prisma.questionDoubt.update({
        where: { id },
        data: { resolvedAt: new Date(), resolvedById: actor.id },
      });
    }
    await this.notify.user(
      parent.userId,
      "student.doubt_answered",
      "Your mentor answered your doubt",
      text.length > 120 ? `${text.slice(0, 117)}…` : text,
      { questionId: parent.questionId, doubtId: id },
    );
    return this.doubt(actor, id);
  }

  async resolveDoubt(
    actor: RequestUser,
    id: string,
    resolved: boolean,
  ): Promise<MentorDoubtThread> {
    await this.doubtOrThrow(actor, id);
    await this.prisma.questionDoubt.update({
      where: { id },
      data: resolved
        ? { resolvedAt: new Date(), resolvedById: actor.id }
        : { resolvedAt: null, resolvedById: null },
    });
    return this.doubt(actor, id);
  }

  // ------------------------------------------------------------ batch progress

  async batchProgress(actor: RequestUser, cohortId: string): Promise<BatchProgressView> {
    await this.scope.assert(actor, "cohort", cohortId);
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
      select: {
        name: true,
        courseId: true,
        course: { select: { title: true } },
        members: { select: { user: { select: USER_NAME_SELECT } } },
      },
    });
    if (!cohort) throw new NotFoundException("Batch not found");
    const userIds = cohort.members.map((m) => m.user.id);
    const lessons = cohort.courseId
      ? await this.prisma.lesson.findMany({
          where: {
            deletedAt: null,
            status: "PUBLISHED",
            module: {
              deletedAt: null,
              topic: { deletedAt: null, subject: { courseId: cohort.courseId, deletedAt: null } },
            },
          },
          select: {
            id: true,
            module: {
              select: {
                topic: {
                  select: {
                    id: true,
                    title: true,
                    position: true,
                    subject: { select: { title: true, position: true } },
                  },
                },
              },
            },
          },
        })
      : [];
    const done = await this.prisma.lessonProgress.findMany({
      where: {
        userId: { in: userIds },
        lessonId: { in: lessons.map((l) => l.id) },
        completedAt: { not: null },
      },
      select: { userId: true, lessonId: true },
    });
    const holds = await this.prisma.topicMark.findMany({
      where: { userId: { in: userIds }, onHold: true },
      select: { topicId: true },
    });
    const topics = new Map<
      string,
      { title: string; subjectTitle: string; order: number; lessonIds: string[] }
    >();
    for (const l of lessons) {
      const t = l.module.topic;
      const e = topics.get(t.id) ?? {
        title: t.title,
        subjectTitle: t.subject.title,
        order: t.subject.position * 1000 + t.position,
        lessonIds: [],
      };
      e.lessonIds.push(l.id);
      topics.set(t.id, e);
    }
    const doneBy = new Map<string, Set<string>>();
    for (const d of done) {
      const set = doneBy.get(d.userId) ?? new Set<string>();
      set.add(d.lessonId);
      doneBy.set(d.userId, set);
    }
    const today = todayIndia();
    const stats = await this.insights.stats(
      userIds,
      addDays(today, -30),
      today,
      cohort.courseId ? [cohort.courseId] : null,
    );
    const att = await this.attendance.percentByStudent(
      cohortId,
      userIds,
      addDays(today, -30),
      today,
    );
    return {
      cohortId,
      cohortName: cohort.name,
      courseTitle: cohort.course?.title ?? null,
      lessonsTotal: lessons.length,
      topics: [...topics.entries()]
        .sort((a, b) => a[1].order - b[1].order)
        .map(([topicId, t]) => {
          let completed = 0;
          let started = 0;
          for (const id of userIds) {
            const mine = doneBy.get(id);
            const n = t.lessonIds.filter((l) => mine?.has(l)).length;
            if (n === t.lessonIds.length && n > 0) completed++;
            else if (n > 0) started++;
          }
          return {
            topicId,
            title: t.title,
            subjectTitle: t.subjectTitle,
            completedPercent: userIds.length ? Math.round((completed / userIds.length) * 100) : 0,
            started,
            onHold: holds.filter((h) => h.topicId === topicId).length,
          };
        }),
      students: cohort.members
        .map(({ user }) => {
          const n = doneBy.get(user.id)?.size ?? 0;
          const st = stats.get(user.id);
          return {
            userId: user.id,
            name: personName(user),
            email: user.email,
            lessonsDone: n,
            percent: lessons.length ? Math.round((n / lessons.length) * 100) : 0,
            attendancePercent: att.get(user.id) ?? null,
            avgQuizPercent: st?.avgQuizPercent ?? null,
            lastActiveAt: st?.lastActiveAt?.toISOString() ?? null,
          };
        })
        .sort((a, b) => b.percent - a.percent),
    };
  }

  // ------------------------------------------------------------ workload

  async workload(mentorId: string): Promise<MentorWorkloadView> {
    const s = await this.scope.mentorScope(mentorId);
    const since = addDays(new Date(), -30);
    const today = todayIndia();
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: mentorId },
      select: USER_NAME_SELECT,
    });
    const cohorts = await this.prisma.cohort.findMany({
      where: { id: { in: s.cohortIds } },
      select: { schedule: true },
    });
    const [
      marked,
      pendingAtt,
      pendingSub,
      pendingSketch,
      reviewed,
      reviewedSubs,
      replies,
      reports,
      shoutouts,
      quizzes,
    ] = await Promise.all([
      this.prisma.classSession.count({ where: { takenById: mentorId, takenAt: { gte: since } } }),
      this.prisma.classSession.count({
        where: {
          cohortId: { in: s.cohortIds },
          takenAt: null,
          cancelled: false,
          date: { gte: addDays(today, -7), lt: today },
        },
      }),
      this.prisma.assignmentSubmission.count({
        where: { reviewerId: mentorId, status: { in: [...WAITING_SUBMISSION] } },
      }),
      this.prisma.quizAttemptAnswer.count({
        where: {
          uploadAssetId: { not: null },
          attempt: { status: { in: [...FINISHED] }, userId: { in: s.studentIds } },
          OR: [{ sketchReview: null }, { sketchReview: { expertReviewedAt: null } }],
        },
      }),
      this.prisma.sketchReview.findMany({
        where: { expertId: mentorId, expertReviewedAt: { gte: since } },
        select: { expertReviewedAt: true, answer: { select: { answeredAt: true } } },
      }),
      this.prisma.assignmentReview.count({
        where: { reviewerId: mentorId, publishedAt: { gte: since } },
      }),
      this.prisma.questionDoubt.findMany({
        where: { userId: mentorId, parentId: { not: null }, createdAt: { gte: since } },
        select: { createdAt: true, parent: { select: { createdAt: true } } },
      }),
      this.prisma.progressReport.count({ where: { mentorId, submittedAt: { gte: since } } }),
      this.prisma.mentorShoutout.count({ where: { mentorId, createdAt: { gte: since } } }),
      this.prisma.quiz.count({ where: { createdById: mentorId, publishedAt: { gte: since } } }),
    ]);
    const turn = reviewed
      .map((r) =>
        r.answer.answeredAt && r.expertReviewedAt
          ? r.expertReviewedAt.getTime() - r.answer.answeredAt.getTime()
          : null,
      )
      .filter((x): x is number => x !== null && x >= 0);
    const resp = replies
      .map((r) => (r.parent ? r.createdAt.getTime() - r.parent.createdAt.getTime() : null))
      .filter((x): x is number => x !== null && x >= 0);
    const avg = (xs: number[]) =>
      xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length / 3_600_000) : null;
    return {
      mentor: person(me),
      batches: s.cohortIds.length,
      students: s.studentIds.length,
      classesPerWeek: cohorts.reduce(
        (n, c) => n + (Array.isArray(c.schedule) ? c.schedule.length : 0),
        0,
      ),
      attendanceMarked30: marked,
      attendancePending: pendingAtt,
      pendingReviews: pendingSub + pendingSketch,
      reviewedLast30: reviewed.length + reviewedSubs,
      avgTurnaroundHours: avg(turn),
      doubtsAnswered30: replies.length,
      avgDoubtResponseHours: avg(resp),
      reportsSubmitted30: reports,
      shoutouts30: shoutouts,
      quizzesPublished30: quizzes,
    };
  }

  async performance(): Promise<MentorWorkloadView[]> {
    const mentors = await this.prisma.user.findMany({
      where: { deletedAt: null, roles: { some: { role: { name: "MENTOR" } } } },
      select: { id: true },
    });
    const rows = await Promise.all(mentors.map((m) => this.workload(m.id)));
    return rows.sort((a, b) => b.students - a.students);
  }
}
