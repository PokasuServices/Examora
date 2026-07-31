import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StudentAnalyticsService } from "../analytics/student/student-analytics.service";

export interface EnrolledCourseCategory {
  courseId: string;
  categoryId: string | null;
  categoryName: string | null;
}

export interface CourseSubject {
  id: string;
  title: string;
  courseId: string;
}

/**
 * Shared "what is this student actively doing" lookups for the
 * recommendation domain services (Sprint 11, ADR-0021 §2) — reuses
 * StudentAnalyticsService (Sprint 10) for the enrollment/completion signal
 * rather than re-querying it, and centralizes the category/subject
 * navigational reads so Course/Quiz/Assignment recommendation services don't
 * each duplicate them.
 */
@Injectable()
export class RecommendationContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentAnalytics: StudentAnalyticsService,
  ) {}

  /** Active enrollments with completion — the core "user interest" signal (ADR-0021 §2). */
  async getActiveEnrollments(userId: string) {
    return this.studentAnalytics.getCourseCompletion(userId);
  }

  async getCourseCategories(courseIds: string[]): Promise<Map<string, EnrolledCourseCategory>> {
    if (courseIds.length === 0) return new Map();
    const courses = await this.prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, categoryId: true, category: { select: { name: true } } },
    });
    return new Map(
      courses.map((c) => [
        c.id,
        { courseId: c.id, categoryId: c.categoryId, categoryName: c.category?.name ?? null },
      ]),
    );
  }

  async getCourseSubjects(courseIds: string[]): Promise<CourseSubject[]> {
    if (courseIds.length === 0) return [];
    return this.prisma.subject.findMany({
      where: { courseId: { in: courseIds }, status: "PUBLISHED" },
      select: { id: true, title: true, courseId: true },
    });
  }
}
