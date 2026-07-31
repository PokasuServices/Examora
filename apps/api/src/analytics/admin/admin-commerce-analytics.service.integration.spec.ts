import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminCommerceAnalyticsService } from "./admin-commerce-analytics.service";

describe("AdminCommerceAnalyticsService (integration)", () => {
  let service: AdminCommerceAnalyticsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let studentId: string;
  let courseId: string;
  let orderId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [AdminCommerceAnalyticsService, PrismaService],
    }).compile();
    service = moduleRef.get(AdminCommerceAnalyticsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const student = await prisma.user.create({
      data: { email: `commerce-analytics-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student.id;

    const course = await prisma.course.create({
      data: {
        title: `Commerce Analytics Course ${suffix}`,
        slug: `commerce-analytics-course-${suffix}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
        priceAmount: 1500,
      },
    });
    courseId = course.id;

    const order = await prisma.order.create({
      data: {
        userId: studentId,
        courseId,
        status: "PAID",
        subtotalAmount: 1500,
        totalAmount: 1500,
      },
    });
    orderId = order.id;

    await prisma.payment.create({
      data: {
        orderId,
        gatewayOrderId: `gw_${suffix}`,
        gatewayPaymentId: `pay_${suffix}`,
        status: "CAPTURED",
        amount: 1500,
        verifiedAt: new Date(),
      },
    });

    await prisma.enrollment.create({
      data: { userId: studentId, courseId, orderId, status: "ACTIVE", source: "PURCHASE" },
    });
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({ where: { userId: studentId } });
    await prisma.payment.deleteMany({ where: { orderId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { id: studentId } });
    await moduleRef.close();
  });

  it("counts real enrollments by status and source", async () => {
    const analytics = await service.getEnrollmentAnalytics(30);
    expect(analytics.totalEnrollments).toBeGreaterThanOrEqual(1);
    expect(analytics.activeEnrollments).toBeGreaterThanOrEqual(1);
    const purchaseBucket = analytics.enrollmentsBySource.find((s) => s.source === "PURCHASE");
    expect(purchaseBucket?.count).toBeGreaterThanOrEqual(1);
    expect(analytics.enrollmentsByDay.length).toBe(30);
  });

  it("sums captured payments into real revenue figures", async () => {
    const analytics = await service.getRevenueAnalytics(30);
    expect(analytics.totalRevenue).toBeGreaterThanOrEqual(1500);
    expect(analytics.ordersPaid).toBeGreaterThanOrEqual(1);
    expect(analytics.averageOrderValue).toBeGreaterThan(0);
    expect(analytics.revenueByDay.reduce((s, p) => s + p.amount, 0)).toBeGreaterThanOrEqual(1500);
  });
});
