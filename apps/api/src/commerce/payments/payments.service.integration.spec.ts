import { UnauthorizedException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { AuditService } from "../../audit/audit.service";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { PrismaService } from "../../prisma/prisma.service";
import { FakePaymentGatewayService } from "../../../test/support/fake-payment-gateway.service";
import { CouponsService } from "../coupons/coupons.service";
import { PAYMENT_GATEWAY_PORT } from "../payment-gateway.port";
import { PaymentsService } from "./payments.service";

describe("PaymentsService (integration)", () => {
  let service: PaymentsService;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  let studentId: string;
  let courseId: string;
  const suffix = `${Date.now()}`;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        EnrollmentService,
        CouponsService,
        AuditService,
        PrismaService,
        { provide: PAYMENT_GATEWAY_PORT, useClass: FakePaymentGatewayService },
      ],
    }).compile();
    service = moduleRef.get(PaymentsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const student = await prisma.user.create({
      data: { email: `payment-student-${suffix}@example.test`, status: "ACTIVE" },
    });
    studentId = student.id;

    const course = await prisma.course.create({
      data: {
        title: `Payment Course ${suffix}`,
        slug: `payment-course-${suffix}`,
        priceAmount: 1500,
        priceCurrency: "INR",
        status: "PUBLISHED",
      },
    });
    courseId = course.id;
  });

  afterAll(async () => {
    await prisma.invoice.deleteMany({ where: { order: { userId: studentId } } });
    await prisma.payment.deleteMany({ where: { order: { userId: studentId } } });
    await prisma.enrollment.deleteMany({ where: { userId: studentId } });
    await prisma.order.deleteMany({ where: { userId: studentId } });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { id: studentId } });
    await moduleRef.close();
  });

  async function createPendingOrder() {
    const order = await prisma.order.create({
      data: {
        userId: studentId,
        courseId,
        status: "PENDING",
        subtotalAmount: 1500,
        discountAmount: 0,
        totalAmount: 1500,
        currency: "INR",
      },
    });
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        gatewayOrderId: `gw_order_${order.id}`,
        amount: 1500,
        currency: "INR",
        status: "CREATED",
      },
    });
    return { order, payment };
  }

  it("rejects a webhook with a missing or invalid signature", async () => {
    await expect(service.handleWebhook("{}", undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.handleWebhook("{}", "wrong-signature")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("a verified payment.captured webhook marks the order PAID and grants an enrollment", async () => {
    const { order, payment } = await createPendingOrder();
    const { rawBody, signature } = FakePaymentGatewayService.sign({
      gatewayOrderId: payment.gatewayOrderId,
      gatewayPaymentId: `gw_pay_${order.id}`,
      event: "payment.captured",
    });

    await service.handleWebhook(rawBody, signature);

    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe("PAID");
    const updatedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updatedPayment.status).toBe("CAPTURED");
    expect(updatedPayment.verifiedAt).not.toBeNull();

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: studentId, courseId } },
    });
    expect(enrollment?.status).toBe("ACTIVE");
    expect(enrollment?.source).toBe("PURCHASE");

    const invoice = await prisma.invoice.findUnique({ where: { orderId: order.id } });
    expect(invoice).not.toBeNull();
  });

  it("is idempotent — replaying the same captured webhook does not error or duplicate side effects", async () => {
    const { order, payment } = await createPendingOrder();
    const gatewayPaymentId = `gw_pay_idem_${order.id}`;
    const { rawBody, signature } = FakePaymentGatewayService.sign({
      gatewayOrderId: payment.gatewayOrderId,
      gatewayPaymentId,
      event: "payment.captured",
    });

    await service.handleWebhook(rawBody, signature);
    await service.handleWebhook(rawBody, signature);

    const invoiceCount = await prisma.invoice.count({ where: { orderId: order.id } });
    expect(invoiceCount).toBe(1);
  });

  it("a payment.failed webhook marks the order FAILED", async () => {
    const { order, payment } = await createPendingOrder();
    const { rawBody, signature } = FakePaymentGatewayService.sign({
      gatewayOrderId: payment.gatewayOrderId,
      gatewayPaymentId: `gw_pay_fail_${order.id}`,
      event: "payment.failed",
    });

    await service.handleWebhook(rawBody, signature);

    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe("FAILED");
    const updatedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updatedPayment.status).toBe("FAILED");
  });

  it("silently ignores a webhook for an unknown gateway order id", async () => {
    const { rawBody, signature } = FakePaymentGatewayService.sign({
      gatewayOrderId: "gw_order_does_not_exist",
      gatewayPaymentId: "gw_pay_ghost",
      event: "payment.captured",
    });
    await expect(service.handleWebhook(rawBody, signature)).resolves.toBeUndefined();
  });
});
