import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const PUBLISHED = { status: "PUBLISHED" as const, deletedAt: null };

/**
 * Student-facing read access to PUBLISHED quizzes (ADR-0014, mirrors the
 * Sprint 3 CatalogService split). Never exposes question content — that's
 * revealed only once an attempt is started (QuizAttemptsService).
 */
@Injectable()
export class QuizCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublishedQuizzes(params: { page: number; pageSize: number; subjectId?: string }) {
    const where = { ...PUBLISHED, ...(params.subjectId ? { subjectId: params.subjectId } : {}) };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.quiz.findMany({
        where,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.quiz.count({ where }),
    ]);

    const aggregates = await this.prisma.quizQuestion.groupBy({
      by: ["quizId"],
      where: { quizId: { in: items.map((q) => q.id) } },
      _count: { _all: true },
      _sum: { marks: true },
    });
    const aggByQuiz = new Map(aggregates.map((a) => [a.quizId, a]));

    return { items, total, aggByQuiz };
  }

  async getPublishedQuizOrThrow(id: string) {
    const quiz = await this.prisma.quiz.findFirst({ where: { id, ...PUBLISHED } });
    if (!quiz) {
      throw new NotFoundException("Quiz not found");
    }
    return quiz;
  }

  async getDetail(id: string) {
    const quiz = await this.getPublishedQuizOrThrow(id);
    const [sections, sectionCounts, totalAgg] = await Promise.all([
      this.prisma.quizSection.findMany({ where: { quizId: id }, orderBy: { position: "asc" } }),
      this.prisma.quizQuestion.groupBy({
        by: ["sectionId"],
        where: { quizId: id },
        _count: { _all: true },
      }),
      this.prisma.quizQuestion.aggregate({
        where: { quizId: id },
        _count: { _all: true },
        _sum: { marks: true },
      }),
    ]);

    const countBySection = new Map(sectionCounts.map((c) => [c.sectionId, c._count._all]));
    return {
      quiz,
      sections,
      countBySection,
      totalQuestions: totalAgg._count._all,
      totalMarks: totalAgg._sum.marks,
    };
  }
}
