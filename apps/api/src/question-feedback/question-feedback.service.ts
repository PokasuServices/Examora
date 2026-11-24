import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { QuestionDoubtView, QuestionReportView } from "@examora/types";
import { shortName } from "../assessment/quiz-attempts/attempt-analysis.service";
import { PrismaService } from "../prisma/prisma.service";

/** Claps needed for a doubt to be tagged "popular". */
const POPULAR_CLAPS = 2;

/**
 * "Report question" and per-question doubts/explanations with claps
 * (student module redesign, phase 5). Doubts are visible to anyone who can
 * read quizzes; only their author (or a moderator) can delete one.
 */
@Injectable()
export class QuestionFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertQuestion(questionId: string): Promise<void> {
    const q = await this.prisma.question.findFirst({
      where: { id: questionId, deletedAt: null },
      select: { id: true },
    });
    if (!q) throw new NotFoundException("Question not found");
  }

  // -------------------------------------------------------------- reports

  async report(userId: string, questionId: string, message: string, attemptId?: string) {
    await this.assertQuestion(questionId);
    await this.prisma.questionReport.create({
      data: { userId, questionId, message: message.trim(), attemptId: attemptId ?? null },
    });
  }

  async listReports(status: "OPEN" | "RESOLVED" | undefined): Promise<QuestionReportView[]> {
    const rows = await this.prisma.questionReport.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { question: { select: { text: true } }, user: { select: { email: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      questionId: r.questionId,
      questionText: r.question.text,
      reporterEmail: r.user.email,
      message: r.message,
      status: r.status === "RESOLVED" ? "RESOLVED" : "OPEN",
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async setReportStatus(id: string, status: "OPEN" | "RESOLVED"): Promise<void> {
    const found = await this.prisma.questionReport.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException("Report not found");
    await this.prisma.questionReport.update({
      where: { id },
      data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null },
    });
  }

  // -------------------------------------------------------------- doubts

  async listDoubts(userId: string, questionId: string): Promise<QuestionDoubtView[]> {
    await this.assertQuestion(questionId);
    const rows = await this.prisma.questionDoubt.findMany({
      where: { questionId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        claps: { select: { userId: true } },
      },
    });
    const view = (r: (typeof rows)[number]) => ({
      id: r.id,
      body: r.body,
      authorName: shortName(r.user.firstName, r.user.lastName, r.user.email),
      isMine: r.userId === userId,
      createdAt: r.createdAt.toISOString(),
      claps: r.claps.length,
      clappedByMe: r.claps.some((c) => c.userId === userId),
    });
    const top = rows.filter((r) => r.parentId === null);
    return top
      .map((r) => ({
        ...view(r),
        popular: r.claps.length >= POPULAR_CLAPS,
        replies: rows.filter((c) => c.parentId === r.id).map(view),
      }))
      .sort((a, b) => b.claps - a.claps || a.createdAt.localeCompare(b.createdAt));
  }

  async postDoubt(userId: string, questionId: string, body: string, parentId?: string) {
    await this.assertQuestion(questionId);
    if (parentId) {
      const parent = await this.prisma.questionDoubt.findFirst({
        where: { id: parentId, questionId, deletedAt: null, parentId: null },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException("Doubt not found");
    }
    await this.prisma.questionDoubt.create({
      data: { userId, questionId, body: body.trim(), parentId: parentId ?? null },
    });
  }

  async toggleClap(userId: string, doubtId: string): Promise<{ clapped: boolean }> {
    const doubt = await this.prisma.questionDoubt.findFirst({
      where: { id: doubtId, deletedAt: null },
      select: { id: true },
    });
    if (!doubt) throw new NotFoundException("Doubt not found");
    const existing = await this.prisma.doubtClap.findUnique({
      where: { doubtId_userId: { doubtId, userId } },
    });
    if (existing) {
      await this.prisma.doubtClap.delete({ where: { doubtId_userId: { doubtId, userId } } });
      return { clapped: false };
    }
    await this.prisma.doubtClap.create({ data: { doubtId, userId } });
    return { clapped: true };
  }

  async deleteDoubt(userId: string, doubtId: string, canModerate: boolean): Promise<void> {
    const doubt = await this.prisma.questionDoubt.findFirst({
      where: { id: doubtId, deletedAt: null },
      select: { userId: true },
    });
    if (!doubt) throw new NotFoundException("Doubt not found");
    if (doubt.userId !== userId && !canModerate) {
      throw new ForbiddenException("You can only delete your own posts");
    }
    await this.prisma.questionDoubt.update({
      where: { id: doubtId },
      data: { deletedAt: new Date() },
    });
  }
}
