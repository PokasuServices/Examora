import { Injectable } from "@nestjs/common";
import type { AdminCourseProgress } from "@examora/types";
import { PrismaService } from "../prisma/prisma.service";

const PUBLISHED = { status: "PUBLISHED" as const, deletedAt: null };

/** Read-only aggregate progress reporting for administrators (ADR-0013). */
@Injectable()
export class AdminProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async listCourseProgress(params: { page: number; pageSize: number }) {
    const where = PUBLISHED;
    const [courses, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        select: { id: true, title: true },
      }),
      this.prisma.course.count({ where }),
    ]);

    const items = await Promise.all(courses.map((c) => this.buildCourseProgress(c.id, c.title)));
    return { items, total };
  }

  async getCourseProgress(courseId: string, title: string): Promise<AdminCourseProgress> {
    return this.buildCourseProgress(courseId, title);
  }

  private async buildCourseProgress(courseId: string, title: string): Promise<AdminCourseProgress> {
    const totalPublishedLessons = await this.countPublishedLessons(courseId);

    // Per-learner completed-lesson counts, computed in one grouped query.
    const grouped = await this.prisma.lessonProgress.groupBy({
      by: ["userId"],
      where: { courseId, completedAt: { not: null } },
      _count: { _all: true },
    });

    const learnerCount = await this.prisma.lessonProgress
      .findMany({ where: { courseId }, distinct: ["userId"], select: { userId: true } })
      .then((rows) => rows.length);

    const totalLessonCompletions = grouped.reduce((sum, g) => sum + g._count._all, 0);
    const completedLearnerCount =
      totalPublishedLessons === 0
        ? 0
        : grouped.filter((g) => g._count._all >= totalPublishedLessons).length;

    return {
      courseId,
      courseTitle: title,
      totalPublishedLessons,
      learnerCount,
      completedLearnerCount,
      totalLessonCompletions,
    };
  }

  private async countPublishedLessons(courseId: string): Promise<number> {
    return this.prisma.lesson.count({
      where: {
        ...PUBLISHED,
        module: {
          ...PUBLISHED,
          topic: { ...PUBLISHED, subject: { ...PUBLISHED, courseId, course: PUBLISHED } },
        },
      },
    });
  }
}
