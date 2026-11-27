import { Injectable } from "@nestjs/common";
import type { ProgressReportSummary } from "@examora/types";
import { PrismaService } from "../prisma/prisma.service";
import { pct } from "./desk-util";

export interface StudentStats extends ProgressReportSummary {
  userId: string;
  lastActiveAt: Date | null;
  lastThreeAbsent: boolean;
}

/**
 * Per-student numbers the mentor module shows (Today's at-risk list, report
 * cards, batch progress): attendance, quizzes, daily quiz, sketches,
 * assignments and lessons over a date range.
 */
@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(
    userIds: string[],
    from: Date,
    to: Date,
    courseIds: string[] | null = null,
  ): Promise<Map<string, StudentStats>> {
    const out = new Map<string, StudentStats>();
    if (userIds.length === 0) return out;
    const toEnd = new Date(to.getTime() + 86_400_000 - 1);
    const p = this.prisma;
    const [
      att,
      lastAtt,
      attempts,
      daily,
      sketches,
      submissions,
      lessons,
      recentLesson,
      recentAttempt,
      weak,
    ] = await Promise.all([
      p.attendanceRecord.findMany({
        where: {
          userId: { in: userIds },
          session: { cancelled: false, date: { gte: from, lte: to }, takenAt: { not: null } },
        },
        select: { userId: true, status: true },
      }),
      p.attendanceRecord.findMany({
        where: { userId: { in: userIds }, session: { cancelled: false, takenAt: { not: null } } },
        orderBy: { session: { date: "desc" } },
        select: { userId: true, status: true },
        take: userIds.length * 6,
      }),
      p.quizAttempt.findMany({
        where: {
          userId: { in: userIds },
          status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
          submittedAt: { gte: from, lte: toEnd },
        },
        select: { userId: true, percentage: true },
      }),
      p.dailyQuizAttempt.findMany({
        where: {
          userId: { in: userIds },
          finishedAt: { not: null },
          dailyQuiz: { date: { gte: from, lte: to } },
        },
        select: { userId: true },
      }),
      p.sketchReview.findMany({
        where: {
          expertReviewedAt: { gte: from, lte: toEnd },
          answer: { attempt: { userId: { in: userIds } } },
        },
        select: { answer: { select: { attempt: { select: { userId: true } } } } },
      }),
      p.assignmentSubmission.findMany({
        where: { studentId: { in: userIds }, submittedAt: { gte: from, lte: toEnd } },
        select: { studentId: true, assignmentId: true },
      }),
      p.lessonProgress.findMany({
        where: {
          userId: { in: userIds },
          completedAt: { gte: from, lte: toEnd },
          ...(courseIds ? { courseId: { in: courseIds } } : {}),
        },
        select: { userId: true },
      }),
      p.lessonProgress.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _max: { lastViewedAt: true },
      }),
      p.quizAttempt.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _max: { startedAt: true },
      }),
      p.quizAttemptAnswer.findMany({
        where: {
          attempt: { userId: { in: userIds }, submittedAt: { gte: from, lte: toEnd } },
          isCorrect: false,
          question: { topicId: { not: null } },
        },
        select: {
          attempt: { select: { userId: true } },
          question: { select: { topic: { select: { title: true } } } },
        },
        take: 5000,
      }),
    ]);

    const dueAssignments = courseIds
      ? await p.assignment.findMany({
          where: {
            status: "PUBLISHED",
            deletedAt: null,
            deadline: { gte: from, lte: toEnd < new Date() ? toEnd : new Date() },
            subject: { courseId: { in: courseIds } },
          },
          select: { id: true },
        })
      : [];

    for (const id of userIds) {
      const mine = att.filter((a) => a.userId === id);
      const held = mine.filter((a) => a.status !== "EXCUSED").length;
      const attended = mine.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
      const myAttempts = attempts.filter((a) => a.userId === id && a.percentage !== null);
      const mySketches = sketches.filter((s) => s.answer.attempt.userId === id);
      const submitted = new Set(
        submissions.filter((s) => s.studentId === id).map((s) => s.assignmentId),
      );
      const last = lastAtt.filter((a) => a.userId === id).slice(0, 3);
      const weakCount = new Map<string, number>();
      for (const w of weak) {
        if (w.attempt.userId !== id || !w.question.topic) continue;
        weakCount.set(w.question.topic.title, (weakCount.get(w.question.topic.title) ?? 0) + 1);
      }
      const lastLesson = recentLesson.find((r) => r.userId === id)?._max.lastViewedAt ?? null;
      const lastQuiz = recentAttempt.find((r) => r.userId === id)?._max.startedAt ?? null;
      out.set(id, {
        userId: id,
        attendancePercent: pct(attended, held),
        classesHeld: held,
        absences: mine.filter((a) => a.status === "ABSENT").length,
        quizzesTaken: myAttempts.length,
        avgQuizPercent: myAttempts.length
          ? Math.round(myAttempts.reduce((s, a) => s + Number(a.percentage), 0) / myAttempts.length)
          : null,
        dailyQuizDays: daily.filter((d) => d.userId === id).length,
        sketchesMarked: mySketches.length,
        avgSketchPercent: null,
        assignmentsSubmitted: submitted.size,
        assignmentsMissing: dueAssignments.filter((a) => !submitted.has(a.id)).length,
        lessonsCompleted: lessons.filter((l) => l.userId === id).length,
        weakTopics: [...weakCount.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([t]) => t),
        lastActiveAt:
          lastLesson && lastQuiz
            ? lastLesson > lastQuiz
              ? lastLesson
              : lastQuiz
            : (lastLesson ?? lastQuiz),
        lastThreeAbsent: last.length === 3 && last.every((a) => a.status === "ABSENT"),
      });
    }
    return out;
  }
}
