import { BadRequestException, ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, type TestingModule } from "@nestjs/testing";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { PrismaService } from "../../prisma/prisma.service";
import { FakePaymentGatewayService } from "../../../test/support/fake-payment-gateway.service";
import { CouponsService } from "../coupons/coupons.service";
import { PAYMENT_GATEWAY_PORT } from "../payment-gateway.port";
import { OrdersService } from "./orders.service";

describe("OrdersService (integration)", () => {
  let service: OrdersService;
  let couponsService: CouponsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let studentId: string;
  let freeCourseId: string;
  let paidCourseId: string;
  const suffix = `${Date.now()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        CouponsService,
        EnrollmentService,
        PrismaService,
        { provide: PAYMENT_GATEWAY_PORT, useClass: FakePaymentGatewayService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => ({ payments: { razorpay: { keyId: "test_key_id" } } }) },
        },
      ],
    }).compile();
    service = moduleRef.get(OrdersService);
    couponsService = moduleRef.get(CouponsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const student = await prisma.user.create({
      data: { email: `order-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student.id;

    const freeCourse = await prisma.course.create({
      data: {
        title: `Order Free ${suffix}`,
        slug: `order-free-${suffix}`,
        status: "PUBLISHED",
      },
    });
    freeCourseId = freeCourse.id;

    const paidCourse = await prisma.course.create({
      data: {
        title: `Order Paid ${suffix}`,
        slug: `order-paid-${suffix}`,
        priceAmount: 2000,
        priceCurrency: "INR",
        status: "PUBLISHED",
      },
    });
    paidCourseId = paidCourse.id;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { order: { userId: studentId } } });
    await prisma.enrollment.deleteMany({ where: { userId: studentId } });
    await prisma.order.deleteMany({ where: { userId: studentId } });
    await prisma.coupon.deleteMany({ where: { code: { contains: suffix } } });
    await prisma.course.deleteMany({ where: { id: { in: [freeCourseId, paidCourseId] } } });
    await prisma.user.deleteMany({ where: { id: studentId } });
    await moduleRef.close();
  });

  it("rejects checkout for a free course", async () => {
    await expect(service.checkout(studentId, freeCourseId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("creates a PENDING order and a CREATED payment for a paid course", async () => {
    const result = await service.checkout(studentId, paidCourseId);
    expect(result.order.status).toBe("PENDING");
    expect(result.amount).toBe(2000);
    expect(result.gatewayOrderId).toContain("fake_order_");

    const payment = await prisma.payment.findFirst({ where: { orderId: result.order.id } });
    expect(payment?.status).toBe("CREATED");
  });

  it("applies a valid coupon's discount to the order total", async () => {
    const coupon = await couponsService.create(
      { code: `ORDER10-${suffix}`, discountType: "PERCENTAGE", discountValue: 10 },
      studentId,
    );
    const result = await service.checkout(studentId, paidCourseId, coupon.code);
    expect(result.amount).toBe(1800);
    // result.order is the raw Prisma row (Decimal-typed) — DTO mapping to a
    // plain number happens at the controller layer via toOrderSummary().
    expect(Number(result.order.discountAmount)).toBe(200);
  });

  it("rejects checkout when the student already holds an active enrollment", async () => {
    await prisma.enrollment.create({
      data: { userId: studentId, courseId: paidCourseId, status: "ACTIVE", source: "ADMIN_GRANT" },
    });
    await expect(service.checkout(studentId, paidCourseId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("listMine returns only the caller's orders", async () => {
    const { items, total } = await service.listMine(studentId, { page: 1, pageSize: 50 });
    expect(total).toBeGreaterThanOrEqual(2);
    expect(items.every((item) => item.courseId === paidCourseId)).toBe(true);
  });
});
