import { ForbiddenException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { EnrollmentService } from "./enrollment.service";

describe("EnrollmentService (integration)", () => {
  let service: EnrollmentService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let studentId: string;
  let freeCourseId: string;
  let paidCourseId: string;
  let subjectId: string;
  const suffix = `${Date.now()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [EnrollmentService, PrismaService],
    }).compile();
    service = moduleRef.get(EnrollmentService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const student = await prisma.user.create({
      data: { email: `enroll-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student.id;

    const freeCourse = await prisma.course.create({
      data: { title: `Free Course ${suffix}`, slug: `free-course-${suffix}` },
    });
    freeCourseId = freeCourse.id;

    const paidCourse = await prisma.course.create({
      data: {
        title: `Paid Course ${suffix}`,
        slug: `paid-course-${suffix}`,
        priceAmount: 999,
        priceCurrency: "INR",
        status: "PUBLISHED",
      },
    });
    paidCourseId = paidCourse.id;

    const subject = await prisma.subject.create({
      data: { courseId: paidCourseId, title: "Subject", slug: `subject-${suffix}` },
    });
    subjectId = subject.id;
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({ where: { userId: studentId } });
    await prisma.order.deleteMany({ where: { userId: studentId } });
    await prisma.subject.deleteMany({ where: { id: subjectId } });
    await prisma.course.deleteMany({ where: { id: { in: [freeCourseId, paidCourseId] } } });
    await prisma.user.deleteMany({ where: { id: studentId } });
    await moduleRef.close();
  });

  it("assertCourseAccess passes for a free course with no enrollment at all", async () => {
    await expect(service.assertCourseAccess(studentId, freeCourseId)).resolves.toBeUndefined();
  });

  it("assertCourseAccess rejects a paid course with no enrollment", async () => {
    await expect(service.assertCourseAccess(studentId, paidCourseId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("enrollFree rejects a paid course", async () => {
    await expect(service.enrollFree(studentId, paidCourseId)).rejects.toThrow();
  });

  it("enrollFree grants access to a free course", async () => {
    await prisma.course.update({ where: { id: freeCourseId }, data: { status: "PUBLISHED" } });
    const enrollment = await service.enrollFree(studentId, freeCourseId);
    expect(enrollment.status).toBe("ACTIVE");
    expect(enrollment.source).toBe("FREE");
  });

  it("grantFromOrder activates a paid enrollment and assertCourseAccess then passes", async () => {
    const order = await prisma.order.create({
      data: {
        userId: studentId,
        courseId: paidCourseId,
        status: "PAID",
        subtotalAmount: 999,
        discountAmount: 0,
        totalAmount: 999,
        currency: "INR",
      },
    });
    await service.grantFromOrder(studentId, paidCourseId, order.id);
    await expect(service.assertCourseAccess(studentId, paidCourseId)).resolves.toBeUndefined();
  });

  it("assertCourseAccess rejects once the enrollment has expired", async () => {
    await prisma.enrollment.update({
      where: { userId_courseId: { userId: studentId, courseId: paidCourseId } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(service.assertCourseAccess(studentId, paidCourseId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("adminGrant reactivates access regardless of prior expiry/revocation", async () => {
    const granted = await service.adminGrant(studentId, paidCourseId);
    expect(granted.status).toBe("ACTIVE");
    expect(granted.source).toBe("ADMIN_GRANT");
    await expect(service.assertCourseAccess(studentId, paidCourseId)).resolves.toBeUndefined();
  });

  it("adminRevoke blocks further access", async () => {
    const enrollment = await service.getActiveEnrollment(studentId, paidCourseId);
    await service.adminRevoke(enrollment!.id);
    await expect(service.assertCourseAccess(studentId, paidCourseId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("assertSubjectCourseAccess resolves the course via the subject and gates the same way", async () => {
    await service.adminGrant(studentId, paidCourseId);
    await expect(service.assertSubjectCourseAccess(studentId, subjectId)).resolves.toBeUndefined();

    await service.adminRevoke((await service.getActiveEnrollment(studentId, paidCourseId))!.id);
    await expect(service.assertSubjectCourseAccess(studentId, subjectId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("assertSubjectCourseAccess is a no-op when subjectId is null", async () => {
    await expect(service.assertSubjectCourseAccess(studentId, null)).resolves.toBeUndefined();
  });
});
