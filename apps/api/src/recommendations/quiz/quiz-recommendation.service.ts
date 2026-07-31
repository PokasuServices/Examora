import { Injectable } from "@nestjs/common";
import type { QuizRecommendation } from "@examora/types";
import { QuizCatalogService } from "../../assessment/quiz-catalog/quiz-catalog.service";
import { PrismaService } from "../../prisma/prisma.service";
import { clampScore, rankAndExplain } from "../recommendation-scoring.util";
import { RecommendationContextService } from "../recommendation-context.service";

const DEFAULT_LIMIT = 10;

/**
 * Quiz Recommendations (Sprint 11, ADR-0021 §2) — published quizzes in
 * subjects belonging to the student's active enrollments, excluding quizzes
 * already attempted. Candidates come from QuizCatalogService.listPublishedQuizzes()
 * (Sprint 4); the attempted-quiz exclusion is a trivial existence check, not
 * QuizAttemptsService's attempt-lifecycle logic.
 */
@Injectable()
export class QuizRecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quizCatalogService: QuizCatalogService,
    private readonly context: RecommendationContextService,
  ) {}

  async getRecommendedQuizzes(
    userId: string,
    limit = DEFAULT_LIMIT,
  ): Promise<QuizRecommendation[]> {
    const enrollments = await this.context.getActiveEnrollments(userId);
    if (enrollments.length === 0) return [];

    const subjects = await this.context.getCourseSubjects(enrollments.map((e) => e.courseId));
    if (subjects.length === 0) return [];

    const candidateLists = await Promise.all(
      subjects.map((subject) =>
        this.quizCatalogService.listPublishedQuizzes({
          page: 1,
          pageSize: 10,
          subjectId: subject.id,
        }),
      ),
    );
    const allQuizIds = candidateLists.flatMap((list) => list.items.map((q) => q.id));
    if (allQuizIds.length === 0) return [];

    const attempted = await this.prisma.quizAttempt.findMany({
      where: { userId, quizId: { in: allQuizIds } },
      select: { quizId: true },
    });
    const attemptedIds = new Set(attempted.map((a) => a.quizId));

    const candidates: Array<{ item: QuizRecommendation; score: number; reason: string }> = [];
    const seen = new Set<string>();
    subjects.forEach((subject, index) => {
      for (const quiz of candidateLists[index]!.items) {
        if (attemptedIds.has(quiz.id) || seen.has(quiz.id)) continue;
        seen.add(quiz.id);
        candidates.push({
          item: {
            quizId: quiz.id,
            quizTitle: quiz.title,
            subjectId: subject.id,
            subjectTitle: subject.title,
            score: 0,
            reason: "",
          },
          score: clampScore(60),
          reason: `Matches ${subject.title}, part of a course you're enrolled in`,
        });
      }
    });

    return rankAndExplain(candidates, limit).map((c) => ({
      ...c.item,
      score: c.score,
      reason: c.reason,
    }));
  }
}
