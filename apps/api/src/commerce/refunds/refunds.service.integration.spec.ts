import { BadRequestException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { PrismaService } from "../../prisma/prisma.service";
import { fakeNotificationsServiceProvider } from "../../../test/support/fake-notifications-service";
import { RefundsService } from "./refunds.service";

describe("RefundsService (integration)", () => {
  let service: RefundsService;
  let enrollmentService: EnrollmentService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let studentId: string;
  let adminId: string;
  let courseId: string;
  const suffix = `${Date.now()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        RefundsService,
        EnrollmentService,
        PrismaService,
        fakeNotificationsServiceProvider(),
      ],
    }).compile();
    service = moduleRef.get(RefundsService);
    enrollmentService = moduleRef.get(EnrollmentService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const student = await prisma.user.create({
      data: { email: `refund-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student.id;
    const admin = await prisma.user.create({
      data: { email: `refund-admin-${suffix}@example.test`, status: "ACTIVE" },
    });
    adminId = admin.id;

    const course = await prisma.course.create({
      data: {
        title: `Refund Course ${suffix}`,
        slug: `refund-course-${suffix}`,
        priceAmount: 1200,
        priceCurrency: "INR",
        status: "PUBLISHED",
      },
    });
    courseId = course.id;
  });

  afterAll(async () => {
    await prisma.refund.deleteMany({ where: { requestedById: studentId } });
    await prisma.enrollment.deleteMany({ where: { userId: studentId } });
    await prisma.order.deleteMany({ where: { userId: studentId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { id: { in: [studentId, adminId] } } });
    await moduleRef.close();
  });

  async function createPaidOrderWithEnrollment() {
    const order = await prisma.order.create({
      data: {
        userId: studentId,
        courseId,
        status: "PAID",
        subtotalAmount: 1200,
        discountAmount: 0,
        totalAmount: 1200,
        currency: "INR",
      },
    });
    await enrollmentService.grantFromOrder(studentId, courseId, order.id);
    return order;
  }

  it("rejects a refund request on a non-PAID order", async () => {
    const order = await prisma.order.create({
      data: {
        userId: studentId,
        courseId,
        status: "PENDING",
        subtotalAmount: 1200,
        discountAmount: 0,
        totalAmount: 1200,
        currency: "INR",
      },
    });
    await expect(service.request(studentId, order.id, "Changed my mind")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("full request -> approve -> process flow revokes the enrollment and refunds the order", async () => {
    const order = await createPaidOrderWithEnrollment();
    const refund = await service.request(studentId, order.id, "Not what I expected");
    expect(refund.status).toBe("REQUESTED");

    const reviewed = await service.review(adminId, refund.id, "APPROVED");
    expect(reviewed.status).toBe("APPROVED");
    expect(reviewed.reviewedById).toBe(adminId);

    const processed = await service.process(refund.id);
    expect(processed.status).toBe("PROCESSED");

    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe("REFUNDED");

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: studentId, courseId } },
    });
    expect(enrollment?.status).toBe("REVOKED");
  });

  it("rejects processing a refund that has not been approved", async () => {
    const order = await createPaidOrderWithEnrollment();
    const refund = await service.request(studentId, order.id, "Duplicate purchase");
    await expect(service.process(refund.id)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects reviewing a refund twice", async () => {
    const order = await createPaidOrderWithEnrollment();
    const refund = await service.request(studentId, order.id, "Reason");
    await service.review(adminId, refund.id, "DENIED");
    await expect(service.review(adminId, refund.id, "APPROVED")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("listMine returns only the caller's refund requests", async () => {
    const { items, total } = await service.listMine(studentId, { page: 1, pageSize: 50 });
    expect(total).toBeGreaterThanOrEqual(3);
    expect(items.every((item) => item.requestedById === studentId)).toBe(true);
  });
});
