import { Injectable } from "@nestjs/common";
import type {
  ContinueLearningItem,
  CourseRecommendation,
  LearningPathStep,
  SimilarCourseRecommendation,
} from "@examora/types";
import { CatalogService } from "../../learning/catalog.service";
import { ProgressService } from "../../learning/progress.service";
import { clampScore, rankAndExplain } from "../recommendation-scoring.util";
import { RecommendationContextService } from "../recommendation-context.service";

const DEFAULT_LIMIT = 10;

/**
 * Course Recommendations, Similar Courses, Learning Path, and Continue
 * Learning (Sprint 11, ADR-0021 §2). Candidates come from
 * CatalogService.listPublishedCourses() (Sprint 2); Continue Learning is a
 * pure delegate to ProgressService.listContinueLearning() (Sprint 3) — that
 * feature already exists, it is not reimplemented here.
 */
@Injectable()
export class CourseRecommendationService {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly progressService: ProgressService,
    private readonly context: RecommendationContextService,
  ) {}

  async getContinueLearning(userId: string): Promise<ContinueLearningItem[]> {
    const items = await this.progressService.listContinueLearning(userId);
    return items.map((item) => ({
      courseId: item.courseId,
      courseTitle: item.courseTitle,
      completionPercent: item.percentComplete,
      nextLesson: item.nextLesson,
      lastActivityAt: item.lastActivityAt,
      score: clampScore(item.percentComplete),
      reason: `You're ${item.percentComplete}% through this course`,
    }));
  }

  /** Category affinity: recommend published courses in categories the student is already active in. */
  async getRecommendedCourses(
    userId: string,
    limit = DEFAULT_LIMIT,
  ): Promise<CourseRecommendation[]> {
    const enrollments = await this.context.getActiveEnrollments(userId);
    const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
    if (enrollments.length === 0) {
      return this.fallbackPopularCourses(enrolledCourseIds, limit);
    }

    const categoriesByCourse = await this.context.getCourseCategories(
      enrollments.map((e) => e.courseId),
    );
    const affinityWeight = new Map<string, { categoryName: string | null; weight: number }>();
    for (const enrollment of enrollments) {
      const category = categoriesByCourse.get(enrollment.courseId);
      if (!category?.categoryId) continue;
      const existing = affinityWeight.get(category.categoryId);
      affinityWeight.set(category.categoryId, {
        categoryName: category.categoryName,
        weight: (existing?.weight ?? 0) + 1,
      });
    }

    if (affinityWeight.size === 0) {
      return this.fallbackPopularCourses(enrolledCourseIds, limit);
    }

    const candidateLists = await Promise.all(
      [...affinityWeight.entries()].map(([categoryId]) =>
        this.catalogService.listPublishedCourses({ page: 1, pageSize: 20, categoryId }),
      ),
    );

    const candidates: Array<{ item: CourseRecommendation; score: number; reason: string }> = [];
    const seen = new Set<string>();
    [...affinityWeight.entries()].forEach(([categoryId, affinity], index) => {
      for (const course of candidateLists[index]!.items) {
        if (enrolledCourseIds.has(course.id) || seen.has(course.id)) continue;
        seen.add(course.id);
        candidates.push({
          item: {
            courseId: course.id,
            courseTitle: course.title,
            categoryId,
            categoryName: affinity.categoryName,
            score: 0,
            reason: "",
          },
          score: clampScore(40 + affinity.weight * 15),
          reason: `Because you're enrolled in ${affinity.weight} course(s) in ${affinity.categoryName ?? "this category"}`,
        });
      }
    });

    return rankAndExplain(candidates, limit).map((c) => ({
      ...c.item,
      score: c.score,
      reason: c.reason,
    }));
  }

  /** Same category as a reference course (defaults to the student's most-active enrollment). */
  async getSimilarCourses(
    userId: string,
    courseId?: string,
    limit = DEFAULT_LIMIT,
  ): Promise<SimilarCourseRecommendation[]> {
    const referenceCourseId = courseId ?? (await this.mostActiveEnrolledCourseId(userId));
    if (!referenceCourseId) return [];

    const reference = await this.catalogService.getPublishedCourseOrThrow(referenceCourseId);
    if (!reference.categoryId) return [];

    const { items } = await this.catalogService.listPublishedCourses({
      page: 1,
      pageSize: limit + 1,
      categoryId: reference.categoryId,
    });

    return items
      .filter((c) => c.id !== reference.id)
      .slice(0, limit)
      .map((c) => ({
        courseId: c.id,
        courseTitle: c.title,
        referenceCourseId: reference.id,
        referenceCourseTitle: reference.title,
        score: clampScore(70),
        reason: `Similar to ${reference.title}`,
      }));
  }

  /** The next course to take in a category the student is actively progressing through. */
  async getLearningPath(userId: string, limit = DEFAULT_LIMIT): Promise<LearningPathStep[]> {
    const enrollments = await this.context.getActiveEnrollments(userId);
    const inProgress = enrollments
      .filter((e) => e.completionPercent >= 60 && e.completionPercent < 100)
      .sort((a, b) => b.completionPercent - a.completionPercent);
    if (inProgress.length === 0) return [];

    const categoriesByCourse = await this.context.getCourseCategories(
      inProgress.map((e) => e.courseId),
    );
    const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));

    const steps: LearningPathStep[] = [];
    const seen = new Set<string>();
    let order = 1;
    for (const enrollment of inProgress) {
      const category = categoriesByCourse.get(enrollment.courseId);
      if (!category?.categoryId) continue;
      const { items } = await this.catalogService.listPublishedCourses({
        page: 1,
        pageSize: 5,
        categoryId: category.categoryId,
      });
      for (const next of items) {
        if (enrolledCourseIds.has(next.id) || seen.has(next.id)) continue;
        seen.add(next.id);
        steps.push({
          courseId: next.id,
          courseTitle: next.title,
          order: order++,
          score: clampScore(90 - steps.length * 10),
          reason: `Next step after finishing ${enrollment.courseTitle} (${enrollment.completionPercent}% complete)`,
        });
        if (steps.length >= limit) return steps;
      }
    }
    return steps;
  }

  private async mostActiveEnrolledCourseId(userId: string): Promise<string | null> {
    const enrollments = await this.context.getActiveEnrollments(userId);
    if (enrollments.length === 0) return null;
    const sorted = enrollments
      .filter((e) => e.completionPercent > 0 && e.completionPercent < 100)
      .sort((a, b) => b.completionPercent - a.completionPercent);
    return (sorted[0] ?? enrollments[0])!.courseId;
  }

  private async fallbackPopularCourses(
    excludeCourseIds: Set<string>,
    limit: number,
  ): Promise<CourseRecommendation[]> {
    const { items } = await this.catalogService.listPublishedCourses({
      page: 1,
      pageSize: limit + excludeCourseIds.size,
    });
    return items
      .filter((c) => !excludeCourseIds.has(c.id))
      .slice(0, limit)
      .map((c) => ({
        courseId: c.id,
        courseTitle: c.title,
        categoryId: c.categoryId,
        categoryName: null,
        score: clampScore(30),
        reason: "Popular on the platform",
      }));
  }
}
