import { Injectable } from "@nestjs/common";
import type {
  StudentAssignmentDashboard,
  StudentAssignmentItem,
  StudentAssignmentState,
} from "@examora/types";
import { PrismaService } from "../../prisma/prisma.service";

const DAY_MS = 86_400_000;
const SEEN_KEY = "assignments";
/** "Due soon" = not submitted and due within this many days. */
export const DUE_SOON_DAYS = 3;
/** On a first visit, assignments published this recently count as new. */
const FIRST_VISIT_NEW_DAYS = 7;

const OPEN_STATES: StudentAssignmentState[] = ["NOT_STARTED", "DRAFT"];

/** Order for the list: what needs action first, finished work last. */
const STATE_ORDER: Record<StudentAssignmentState, number> = {
  NEEDS_CHANGES: 0,
  DRAFT: 1,
  NOT_STARTED: 2,
  WAITING: 3,
  REVIEWED: 4,
};

function stateOf(status: string | undefined): StudentAssignmentState {
  switch (status) {
    case undefined:
      return "NOT_STARTED";
    case "DRAFT":
      return "DRAFT";
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "WAITING";
    case "REVISION_REQUESTED":
      return "NEEDS_CHANGES";
    default:
      return "REVIEWED";
  }
}

/** Whole calendar days from `now` to `deadline` (negative when it has passed). */
export function daysUntil(deadline: Date, now: Date): number {
  const diff = deadline.getTime() - now.getTime();
  return diff >= 0 ? Math.ceil(diff / DAY_MS) : -Math.ceil(-diff / DAY_MS);
}

/**
 * The Assignments tab overview for one student: every published assignment
 * with where they are on it (latest submission), deadlines, what's new since
 * their last visit, and review results.
 */
@Injectable()
export class StudentAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(userId: string, now = new Date()): Promise<StudentAssignmentDashboard> {
    const [rows, seen] = await Promise.all([
      this.prisma.assignment.findMany({
        where: { status: "PUBLISHED", deletedAt: null },
        select: {
          id: true,
          title: true,
          brief: true,
          marksTotal: true,
          deadline: true,
          publishedAt: true,
          createdAt: true,
          subject: { select: { title: true, course: { select: { title: true } } } },
          submissions: {
            where: { studentId: userId },
            orderBy: { version: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              submittedAt: true,
              review: { select: { status: true, obtainedMarks: true, overallComment: true } },
            },
          },
        },
      }),
      this.prisma.userSeen.findUnique({
        where: { userId_key: { userId, key: SEEN_KEY } },
        select: { seenAt: true },
      }),
    ]);

    const newSince = seen?.seenAt ?? new Date(now.getTime() - FIRST_VISIT_NEW_DAYS * DAY_MS);
    const items: StudentAssignmentItem[] = rows.map((a) => {
      const latest = a.submissions[0];
      const state = stateOf(latest?.status);
      const published = latest?.review?.status === "PUBLISHED" ? latest.review : null;
      const dueInDays = a.deadline ? daysUntil(a.deadline, now) : null;
      return {
        id: a.id,
        title: a.title,
        brief: a.brief,
        marksTotal: Number(a.marksTotal),
        deadline: a.deadline?.toISOString() ?? null,
        publishedAt: (a.publishedAt ?? a.createdAt).toISOString(),
        courseTitle: a.subject?.course.title ?? null,
        subjectTitle: a.subject?.title ?? null,
        state,
        isNew: (a.publishedAt ?? a.createdAt) > newSince && state === "NOT_STARTED",
        dueInDays,
        overdue: dueInDays !== null && a.deadline! < now && OPEN_STATES.includes(state),
        submissionId: latest?.id ?? null,
        submittedAt: latest?.submittedAt?.toISOString() ?? null,
        obtainedMarks: published?.obtainedMarks != null ? Number(published.obtainedMarks) : null,
        reviewerNote: published?.overallComment ?? null,
      };
    });

    items.sort(
      (x, y) =>
        STATE_ORDER[x.state] - STATE_ORDER[y.state] ||
        Number(y.isNew) - Number(x.isNew) ||
        (x.deadline ?? "9999").localeCompare(y.deadline ?? "9999"),
    );

    const reviewed = items.filter((i) => i.state === "REVIEWED" && i.obtainedMarks !== null);
    const averagePercent =
      reviewed.length > 0
        ? Math.round(
            (reviewed.reduce((t, i) => t + i.obtainedMarks! / Math.max(i.marksTotal, 1), 0) /
              reviewed.length) *
              100,
          )
        : null;
    const open = items.filter((i) => OPEN_STATES.includes(i.state));
    return {
      lastSeenAt: seen?.seenAt.toISOString() ?? null,
      counts: {
        total: items.length,
        new: items.filter((i) => i.isNew).length,
        toDo: open.length,
        dueSoon: open.filter(
          (i) => i.dueInDays !== null && !i.overdue && i.dueInDays <= DUE_SOON_DAYS,
        ).length,
        overdue: items.filter((i) => i.overdue).length,
        waiting: items.filter((i) => i.state === "WAITING").length,
        needsChanges: items.filter((i) => i.state === "NEEDS_CHANGES").length,
        reviewed: items.filter((i) => i.state === "REVIEWED").length,
      },
      averagePercent,
      items,
    };
  }

  /** The student has looked at Assignments: what's there now is no longer "new". */
  async markSeen(userId: string, at = new Date()): Promise<void> {
    await this.prisma.userSeen.upsert({
      where: { userId_key: { userId, key: SEEN_KEY } },
      create: { userId, key: SEEN_KEY, seenAt: at },
      update: { seenAt: at },
    });
  }
}
