import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@examora/database";
import { PrismaService } from "../prisma/prisma.service";

const ENROLLMENT_INCLUDE = {
  user: { select: { email: true } },
  course: { select: { title: true } },
} as const;

/**
 * A single current-access-state record per (user, course) — ADR-0018.
 * `assertCourseAccess` is the shared gate every paid-content check (Learning/
 * Quiz/Assignment) calls before granting access; free courses always pass.
 */
@Injectable()
export class EnrollmentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Throws unless the course is free or the user holds an ACTIVE enrollment for it. */
  async assertCourseAccess(userId: string, courseId: string): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { priceAmount: true },
    });
    if (!course || course.priceAmount === null) {
      return;
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment || enrollment.status !== "ACTIVE") {
      throw new ForbiddenException("This course requires an active enrollment");
    }
    if (enrollment.expiresAt && enrollment.expiresAt < new Date()) {
      throw new ForbiddenException("Your enrollment in this course has expired");
    }
  }

  /**
   * A Quiz/Assignment optionally classifies under a Subject, which belongs
   * to a Course (Sprint 4/5's curriculum-taxonomy reuse) — this resolves
   * that chain once so Assessment/Assignments don't each duplicate the
   * Subject lookup. Content with no subject/course link has nothing to gate
   * against and remains unrestricted, matching today's behavior.
   */
  async assertSubjectCourseAccess(userId: string, subjectId: string | null): Promise<void> {
    if (!subjectId) {
      return;
    }
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { courseId: true },
    });
    if (!subject) {
      return;
    }
    await this.assertCourseAccess(userId, subject.courseId);
  }

  async getActiveEnrollment(userId: string, courseId: string) {
    return this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: ENROLLMENT_INCLUDE,
    });
  }

  /** Self-service enrollment in a free course — paid courses only enroll via a confirmed payment. */
  async enrollFree(userId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, deletedAt: null, status: "PUBLISHED" },
      select: { id: true, priceAmount: true },
    });
    if (!course) {
      throw new NotFoundException("Course not found");
    }
    if (course.priceAmount !== null) {
      throw new BadRequestException("This course requires payment — use checkout instead");
    }

    return this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, status: "ACTIVE", source: "FREE" },
      update: { status: "ACTIVE", source: "FREE", revokedAt: null, expiresAt: null },
      include: ENROLLMENT_INCLUDE,
    });
  }

  /** Called by PaymentsService once a webhook confirms payment (ADR-0018 — never a client callback). */
  async grantFromOrder(userId: string, courseId: string, orderId: string, expiresAt?: Date) {
    return this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, orderId, status: "ACTIVE", source: "PURCHASE", expiresAt },
      update: {
        orderId,
        status: "ACTIVE",
        source: "PURCHASE",
        revokedAt: null,
        expiresAt: expiresAt ?? null,
      },
      include: ENROLLMENT_INCLUDE,
    });
  }

  async adminGrant(userId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, deletedAt: null },
      select: { id: true },
    });
    if (!course) {
      throw new NotFoundException("Course not found");
    }

    return this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, status: "ACTIVE", source: "ADMIN_GRANT" },
      // Clears any stale expiresAt from a prior lapsed enrollment — an admin
      // grant is unconditional access, not a renewal of the old term.
      update: { status: "ACTIVE", source: "ADMIN_GRANT", revokedAt: null, expiresAt: null },
      include: ENROLLMENT_INCLUDE,
    });
  }

  async adminRevoke(enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment) {
      throw new NotFoundException("Enrollment not found");
    }
    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: "REVOKED", revokedAt: new Date() },
      include: ENROLLMENT_INCLUDE,
    });
  }

  /** Revokes by (userId, courseId) — used when a refund is processed (ADR-0018). */
  async revokeForRefund(userId: string, courseId: string): Promise<void> {
    await this.prisma.enrollment.updateMany({
      where: { userId, courseId },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
  }

  async listMine(userId: string, params: { page: number; pageSize: number }) {
    const where: Prisma.EnrollmentWhereInput = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where,
        include: ENROLLMENT_INCLUDE,
        orderBy: { enrolledAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.enrollment.count({ where }),
    ]);
    return { items, total };
  }

  async listAll(params: {
    page: number;
    pageSize: number;
    userId?: string;
    courseId?: string;
    status?: "ACTIVE" | "EXPIRED" | "REVOKED";
  }) {
    const where: Prisma.EnrollmentWhereInput = {
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.courseId ? { courseId: params.courseId } : {}),
      ...(params.status ? { status: params.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where,
        include: ENROLLMENT_INCLUDE,
        orderBy: { enrolledAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.enrollment.count({ where }),
    ]);
    return { items, total };
  }
}
