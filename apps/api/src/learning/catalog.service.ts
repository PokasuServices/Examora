import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@examora/database";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { PrismaService } from "../prisma/prisma.service";

const PUBLISHED = { status: "PUBLISHED" as const, deletedAt: null };
const BY_POSITION = { position: "asc" as const };

/**
 * Student-facing read access to PUBLISHED content (ADR-0013). Every level is
 * filtered to PUBLISHED; a lesson is only reachable when its whole ancestor
 * chain (module → topic → subject → course) is published — otherwise it is
 * indistinguishable from "not found".
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  async listPublishedCourses(params: {
    page: number;
    pageSize: number;
    categoryId?: string;
    examType?: string;
  }) {
    const where: Prisma.CourseWhereInput = {
      ...PUBLISHED,
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.examType ? { examType: params.examType } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        orderBy: [BY_POSITION, { createdAt: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.course.count({ where }),
    ]);

    return { items, total };
  }

  async getPublishedCourseOrThrow(id: string) {
    const course = await this.prisma.course.findFirst({ where: { id, ...PUBLISHED } });
    if (!course) {
      throw new NotFoundException("Course not found");
    }
    return course;
  }

  /** Full published curriculum tree for a course, with the caller's progress attached. */
  async getCurriculum(courseId: string, userId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, ...PUBLISHED },
      include: {
        subjects: {
          where: PUBLISHED,
          orderBy: BY_POSITION,
          include: {
            topics: {
              where: PUBLISHED,
              orderBy: BY_POSITION,
              include: {
                modules: {
                  where: PUBLISHED,
                  orderBy: BY_POSITION,
                  include: { lessons: { where: PUBLISHED, orderBy: BY_POSITION } },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }
    await this.enrollmentService.assertCourseAccess(userId, courseId);

    const progress = await this.prisma.lessonProgress.findMany({
      where: { userId, courseId },
      select: { lessonId: true, completedAt: true, lastViewedAt: true },
    });
    const progressByLesson = new Map(progress.map((p) => [p.lessonId, p]));

    return { course, progressByLesson };
  }

  /**
   * Returns the lesson content only when the lesson and its entire ancestor
   * chain are published; 404 otherwise. Also returns the caller's progress.
   */
  async getLessonForStudent(lessonId: string, userId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, ...PUBLISHED },
      include: {
        module: {
          include: { topic: { include: { subject: { include: { course: true } } } } },
        },
      },
    });

    if (!lesson || !this.isChainPublished(lesson)) {
      throw new NotFoundException("Lesson not found");
    }
    const courseId = lesson.module.topic.subject.course.id;
    await this.enrollmentService.assertCourseAccess(userId, courseId);

    const progress = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: { completedAt: true, lastViewedAt: true },
    });

    return { lesson, courseId, progress };
  }

  private isChainPublished(lesson: {
    status: string;
    deletedAt: Date | null;
    module: {
      status: string;
      deletedAt: Date | null;
      topic: {
        status: string;
        deletedAt: Date | null;
        subject: {
          status: string;
          deletedAt: Date | null;
          course: { status: string; deletedAt: Date | null };
        };
      };
    };
  }): boolean {
    const nodes = [
      lesson,
      lesson.module,
      lesson.module.topic,
      lesson.module.topic.subject,
      lesson.module.topic.subject.course,
    ];
    return nodes.every((n) => n.status === "PUBLISHED" && n.deletedAt === null);
  }
}
