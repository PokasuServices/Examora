import { Injectable } from "@nestjs/common";
import type { CourseProgress, LearningDashboard, RecentLesson } from "@examora/types";
import { PrismaService } from "../prisma/prisma.service";
import { CatalogService } from "./catalog.service";

const PUBLISHED = { status: "PUBLISHED" as const, deletedAt: null };

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  /** Records/refreshes a view. Verifies the lesson is student-visible first (ADR-0013). */
  async recordView(userId: string, lessonId: string): Promise<void> {
    const { courseId } = await this.catalog.getLessonForStudent(lessonId, userId);
    const now = new Date();
    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { lastViewedAt: now },
      create: { userId, lessonId, courseId, firstViewedAt: now, lastViewedAt: now },
    });
  }

  /** Marks a lesson complete (idempotent — completing an already-complete lesson is a no-op). */
  async complete(
    userId: string,
    lessonId: string,
  ): Promise<{ courseId: string; alreadyComplete: boolean }> {
    const { courseId, progress } = await this.catalog.getLessonForStudent(lessonId, userId);
    if (progress?.completedAt) {
      return { courseId, alreadyComplete: true };
    }

    const now = new Date();
    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { completedAt: now, lastViewedAt: now },
      create: {
        userId,
        lessonId,
        courseId,
        firstViewedAt: now,
        lastViewedAt: now,
        completedAt: now,
      },
    });
    return { courseId, alreadyComplete: false };
  }

  /** Per-course progress: totals, %, last activity, and the next incomplete lesson. */
  async getCourseProgress(userId: string, courseId: string): Promise<CourseProgress> {
    const course = await this.catalog.getPublishedCourseOrThrow(courseId);

    const lessons = await this.publishedLessonOrder(courseId);
    const totalLessons = lessons.length;

    const progressRows = await this.prisma.lessonProgress.findMany({
      where: { userId, courseId },
      select: { lessonId: true, completedAt: true, lastViewedAt: true },
    });
    const completedIds = new Set(
      progressRows.filter((p) => p.completedAt !== null).map((p) => p.lessonId),
    );
    const completedLessons = lessons.filter((l) => completedIds.has(l.id)).length;

    const nextLesson = lessons.find((l) => !completedIds.has(l.id)) ?? null;
    const lastActivityAt = progressRows.reduce<Date | null>((max, p) => {
      return !max || p.lastViewedAt > max ? p.lastViewedAt : max;
    }, null);

    return {
      courseId,
      courseTitle: course.title,
      courseSlug: course.slug,
      totalLessons,
      completedLessons,
      percentComplete: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
      lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
      nextLesson: nextLesson ? { id: nextLesson.id, title: nextLesson.title } : null,
    };
  }

  /** Courses the student has started (has progress) but not fully completed, most-recent first. */
  async listContinueLearning(userId: string): Promise<CourseProgress[]> {
    const startedCourseIds = await this.startedCourseIds(userId);
    const summaries = await Promise.all(
      startedCourseIds.map((courseId) => this.getCourseProgress(userId, courseId)),
    );
    return summaries
      .filter((s) => s.percentComplete < 100 && s.totalLessons > 0)
      .sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""));
  }

  async listRecentlyViewed(userId: string, limit: number): Promise<RecentLesson[]> {
    const rows = await this.prisma.lessonProgress.findMany({
      where: { userId },
      orderBy: { lastViewedAt: "desc" },
      take: limit,
      include: { lesson: { select: { title: true } }, course: { select: { title: true } } },
    });

    return rows.map((r) => ({
      lessonId: r.lessonId,
      lessonTitle: r.lesson.title,
      courseId: r.courseId,
      courseTitle: r.course.title,
      completed: r.completedAt !== null,
      lastViewedAt: r.lastViewedAt.toISOString(),
    }));
  }

  async getDashboard(userId: string): Promise<LearningDashboard> {
    const [continueLearning, recentlyViewed, startedIds, lessonsCompleted] = await Promise.all([
      this.listContinueLearning(userId),
      this.listRecentlyViewed(userId, 10),
      this.startedCourseIds(userId),
      this.prisma.lessonProgress.count({ where: { userId, completedAt: { not: null } } }),
    ]);

    // A course counts as completed when every started course reaches 100%.
    const allCourseSummaries = await Promise.all(
      startedIds.map((courseId) => this.getCourseProgress(userId, courseId)),
    );
    const coursesCompleted = allCourseSummaries.filter(
      (s) => s.totalLessons > 0 && s.percentComplete === 100,
    ).length;

    return {
      continueLearning,
      recentlyViewed,
      stats: {
        coursesStarted: startedIds.length,
        coursesCompleted,
        lessonsCompleted,
      },
    };
  }

  private async startedCourseIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.lessonProgress.findMany({
      where: { userId },
      distinct: ["courseId"],
      select: { courseId: true },
    });
    return rows.map((r) => r.courseId);
  }

  /** Published lessons of a course in curriculum order (subject → topic → module → lesson position). */
  private async publishedLessonOrder(courseId: string): Promise<{ id: string; title: string }[]> {
    const subjects = await this.prisma.subject.findMany({
      where: { courseId, ...PUBLISHED },
      orderBy: { position: "asc" },
      include: {
        topics: {
          where: PUBLISHED,
          orderBy: { position: "asc" },
          include: {
            modules: {
              where: PUBLISHED,
              orderBy: { position: "asc" },
              include: {
                lessons: {
                  where: PUBLISHED,
                  orderBy: { position: "asc" },
                  select: { id: true, title: true },
                },
              },
            },
          },
        },
      },
    });

    const ordered: { id: string; title: string }[] = [];
    for (const subject of subjects) {
      for (const topic of subject.topics) {
        for (const mod of topic.modules) {
          ordered.push(...mod.lessons);
        }
      }
    }
    return ordered;
  }
}
