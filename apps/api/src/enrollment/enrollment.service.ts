import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@examora/database";
import { NotificationsService } from "../notifications/notifications.service";
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

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

  /**
   * Licence check (student module redesign): students don't buy courses, an
   * admin assigns them, so a quiz that belongs to a course needs an ACTIVE,
   * unexpired enrollment whatever the course's price. Quizzes without a
   * subject (standalone) are open.
   */
  async assertLicenceForSubject(userId: string, subjectId: string | null): Promise<void> {
    if (!subjectId) return;
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { courseId: true },
    });
    if (!subject) return;
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: subject.courseId } },
      select: { status: true, expiresAt: true },
    });
    const active =
      enrollment?.status === "ACTIVE" &&
      (enrollment.expiresAt === null || enrollment.expiresAt > new Date());
    if (!active) {
      throw new ForbiddenException("You don't have a licence for this course");
    }
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

    const enrollment = await this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, status: "ACTIVE", source: "FREE" },
      update: { status: "ACTIVE", source: "FREE", revokedAt: null, expiresAt: null },
      include: ENROLLMENT_INCLUDE,
    });
    await this.notifyEnrollmentGranted(enrollment);
    return enrollment;
  }

  /** Called by PaymentsService once a webhook confirms payment (ADR-0018 — never a client callback). */
  async grantFromOrder(userId: string, courseId: string, orderId: string, expiresAt?: Date) {
    const enrollment = await this.prisma.enrollment.upsert({
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
    await this.notifyEnrollmentGranted(enrollment);
    return enrollment;
  }

  private async notifyEnrollmentGranted(enrollment: {
    userId: string;
    courseId: string;
    course: { title: string };
  }): Promise<void> {
    await this.notificationsService.enqueue({
      userId: enrollment.userId,
      eventType: "enrollment.granted",
      category: "learning",
      title: "You're enrolled",
      body: `You now have access to "${enrollment.course.title}".`,
      data: { courseId: enrollment.courseId },
      channels: ["EMAIL"],
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

    const enrollment = await this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, status: "ACTIVE", source: "ADMIN_GRANT" },
      // Clears any stale expiresAt from a prior lapsed enrollment — an admin
      // grant is unconditional access, not a renewal of the old term.
      update: { status: "ACTIVE", source: "ADMIN_GRANT", revokedAt: null, expiresAt: null },
      include: ENROLLMENT_INCLUDE,
    });
    await this.notifyEnrollmentGranted(enrollment);
    return enrollment;
  }

  /**
   * Resolves a bulk-licence target to student ids: every STUDENT, or the
   * given ids (unknown ids are dropped). Exactly one form must be used.
   */
  private async resolveLicenceTargets(target: {
    allStudents?: boolean;
    userIds?: string[];
    cohortId?: string;
  }): Promise<string[]> {
    const hasList = (target.userIds?.length ?? 0) > 0;
    const chosen = [Boolean(target.allStudents), hasList, Boolean(target.cohortId)].filter(Boolean);
    if (chosen.length !== 1) {
      throw new BadRequestException("Choose exactly one of allStudents, userIds or cohortId");
    }
    if (target.cohortId) {
      const members = await this.prisma.cohortMember.findMany({
        where: { cohortId: target.cohortId, user: { deletedAt: null } },
        select: { userId: true },
      });
      return members.map((m) => m.userId);
    }
    const users = await this.prisma.user.findMany({
      where: target.allStudents
        ? { deletedAt: null, roles: { some: { role: { name: "STUDENT" } } } }
        : { deletedAt: null, id: { in: target.userIds } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private async resolveCourses(courseIds: string[]): Promise<string[]> {
    const courses = await this.prisma.course.findMany({
      where: { id: { in: courseIds }, deletedAt: null },
      select: { id: true },
    });
    if (courses.length === 0) {
      throw new NotFoundException("None of the given courses exist");
    }
    return courses.map((c) => c.id);
  }

  /**
   * Grants every (student, course) pair. New pairs are inserted; revoked or
   * expired ones are reactivated; already-active ones are left alone. No
   * per-grant notification is sent, so a bulk run doesn't flood inboxes.
   */
  async adminBulkGrant(target: {
    courseIds: string[];
    allStudents?: boolean;
    userIds?: string[];
    cohortId?: string;
  }) {
    const userIds = await this.resolveLicenceTargets(target);
    const courseIds = await this.resolveCourses(target.courseIds);
    if (userIds.length === 0) return { students: 0, courses: courseIds.length, changed: 0 };

    const now = new Date();
    const { count: created } = await this.prisma.enrollment.createMany({
      data: userIds.flatMap((userId) =>
        courseIds.map((courseId) => ({
          userId,
          courseId,
          status: "ACTIVE" as const,
          source: "ADMIN_GRANT" as const,
        })),
      ),
      skipDuplicates: true,
    });
    const { count: reactivated } = await this.prisma.enrollment.updateMany({
      where: {
        userId: { in: userIds },
        courseId: { in: courseIds },
        OR: [{ status: { not: "ACTIVE" } }, { expiresAt: { lte: now } }],
      },
      data: { status: "ACTIVE", source: "ADMIN_GRANT", revokedAt: null, expiresAt: null },
    });
    return { students: userIds.length, courses: courseIds.length, changed: created + reactivated };
  }

  /** Revokes every active (student, course) pair in the target. */
  async adminBulkRevoke(target: {
    courseIds: string[];
    allStudents?: boolean;
    userIds?: string[];
    cohortId?: string;
  }) {
    const userIds = await this.resolveLicenceTargets(target);
    const courseIds = await this.resolveCourses(target.courseIds);
    const { count } = await this.prisma.enrollment.updateMany({
      where: { userId: { in: userIds }, courseId: { in: courseIds }, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    return { students: userIds.length, courses: courseIds.length, changed: count };
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
