import { Injectable } from "@nestjs/common";
import type { AssignmentRecommendation } from "@examora/types";
import { AssignmentCatalogService } from "../../assignments/catalog/assignment-catalog.service";
import { PrismaService } from "../../prisma/prisma.service";
import { clampScore, rankAndExplain } from "../recommendation-scoring.util";
import { RecommendationContextService } from "../recommendation-context.service";

const DEFAULT_LIMIT = 10;

/**
 * Assignment Recommendations (Sprint 11, ADR-0021 §2) — published
 * assignments in subjects belonging to the student's active enrollments,
 * excluding assignments already submitted. Candidates come from
 * AssignmentCatalogService.listPublished() (Sprint 5).
 */
@Injectable()
export class AssignmentRecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignmentCatalogService: AssignmentCatalogService,
    private readonly context: RecommendationContextService,
  ) {}

  async getRecommendedAssignments(
    userId: string,
    limit = DEFAULT_LIMIT,
  ): Promise<AssignmentRecommendation[]> {
    const enrollments = await this.context.getActiveEnrollments(userId);
    if (enrollments.length === 0) return [];

    const subjects = await this.context.getCourseSubjects(enrollments.map((e) => e.courseId));
    if (subjects.length === 0) return [];

    const candidateLists = await Promise.all(
      subjects.map((subject) =>
        this.assignmentCatalogService.listPublished({
          page: 1,
          pageSize: 10,
          subjectId: subject.id,
        }),
      ),
    );
    const allAssignmentIds = candidateLists.flatMap((list) => list.items.map((a) => a.id));
    if (allAssignmentIds.length === 0) return [];

    const submitted = await this.prisma.assignmentSubmission.findMany({
      where: {
        studentId: userId,
        assignmentId: { in: allAssignmentIds },
        status: { not: "DRAFT" },
      },
      select: { assignmentId: true },
    });
    const submittedIds = new Set(submitted.map((s) => s.assignmentId));

    const candidates: Array<{ item: AssignmentRecommendation; score: number; reason: string }> = [];
    const seen = new Set<string>();
    subjects.forEach((subject, index) => {
      for (const assignment of candidateLists[index]!.items) {
        if (submittedIds.has(assignment.id) || seen.has(assignment.id)) continue;
        seen.add(assignment.id);
        candidates.push({
          item: {
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
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
