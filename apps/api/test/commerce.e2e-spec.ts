import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PAYMENT_GATEWAY_PORT } from "../src/commerce/payment-gateway.port";
import { PrismaService } from "../src/prisma/prisma.service";
import { configureApp } from "../src/setup-app";
import { registerUserWithRoles } from "./support/auth-helpers";
import { FakePaymentGatewayService } from "./support/fake-payment-gateway.service";
import { ensureRolesAndPermissions } from "./support/seed-helpers";

/**
 * Sprint 8 Commerce/Enrollment/Payments e2e (ADR-0018): course pricing, RBAC,
 * entitlement gating over HTTP, the full checkout -> webhook -> entitlement
 * flow (signed against FakePaymentGatewayService rather than a real Razorpay
 * account), coupon-discounted checkout, admin monitoring, and the refund
 * request -> review -> process state machine including its enrollment-revoke
 * side effect. Cross-module gating on Quiz/Assignment endpoints is already
 * covered at the service layer (quiz-attempts/submissions integration specs);
 * this suite focuses on Commerce's own HTTP surface plus one Learning-endpoint
 * check to confirm the gate is actually wired through the controller stack.
 */
describe("Commerce, Enrollment & Payments (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let studentToken: string;
  let studentId: string;
  let student2Token: string;
  const suffix = `${Date.now()}`;
  const createdCourseIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdOrderIds: string[] = [];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PAYMENT_GATEWAY_PORT)
      .useClass(FakePaymentGatewayService)
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await ensureRolesAndPermissions(prisma);

    adminToken = (
      await registerUserWithRoles(app, prisma, `s8-admin-${suffix}@example.test`, ["ADMINISTRATOR"])
    ).accessToken;
    const student = await registerUserWithRoles(app, prisma, `s8-student-${suffix}@example.test`, [
      "STUDENT",
    ]);
    studentToken = student.accessToken;
    studentId = student.userId;
    const student2 = await registerUserWithRoles(
      app,
      prisma,
      `s8-student2-${suffix}@example.test`,
      ["STUDENT"],
    );
    student2Token = student2.accessToken;
  });

  afterAll(async () => {
    await prisma.refund.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.invoice.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.enrollment.deleteMany({ where: { courseId: { in: createdCourseIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.coupon.deleteMany({ where: { code: { contains: suffix } } });
    await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.user.deleteMany({ where: { email: { contains: "s8-" } } });
    await app.close();
  });

  describe("RBAC", () => {
    it("denies unauthenticated access to enrollments and orders", async () => {
      await request(app.getHttpServer()).get("/api/v1/enrollments").expect(401);
      await request(app.getHttpServer()).get("/api/v1/commerce/orders").expect(401);
    });

    it("denies a student creating a coupon or listing all orders/refunds", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/admin/commerce/coupons")
        .set(auth(studentToken))
        .send({ code: `NOPE-${suffix}`, discountType: "FIXED", discountValue: 100 })
        .expect(403);
      await request(app.getHttpServer())
        .get("/api/v1/admin/commerce/orders")
        .set(auth(studentToken))
        .expect(403);
      await request(app.getHttpServer())
        .get("/api/v1/admin/commerce/refunds")
        .set(auth(studentToken))
        .expect(403);
    });
  });

  let categoryId: string;
  let paidCourseId: string;
  let couponCourseId: string;
  let freeCourseId: string;

  describe("Course pricing (admin content, ADR-0018)", () => {
    it("creates a category and a paid, published course", async () => {
      const category = await prisma.category.create({
        data: { name: `s8-cat-${suffix}`, slug: `s8-cat-${suffix}` },
      });
      categoryId = category.id;
      createdCategoryIds.push(categoryId);

      const created = await request(app.getHttpServer())
        .post("/api/v1/admin/content/courses")
        .set(auth(adminToken))
        .send({
          categoryId,
          title: `Paid Course ${suffix}`,
          priceAmount: 1999,
          priceCurrency: "INR",
        })
        .expect(201);
      paidCourseId = created.body.data.id;
      createdCourseIds.push(paidCourseId);
      expect(created.body.data.priceAmount).toBe(1999);
      expect(created.body.data.priceCurrency).toBe("INR");

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/content/courses/${paidCourseId}/status`)
        .set(auth(adminToken))
        .send({ status: "PUBLISHED" })
        .expect(200);
    });

    it("creates a second paid, published course for the coupon flow", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/admin/content/courses")
        .set(auth(adminToken))
        .send({ categoryId, title: `Coupon Course ${suffix}`, priceAmount: 1200 })
        .expect(201);
      couponCourseId = created.body.data.id;
      createdCourseIds.push(couponCourseId);

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/content/courses/${couponCourseId}/status`)
        .set(auth(adminToken))
        .send({ status: "PUBLISHED" })
        .expect(200);
    });

    it("creates a free, published course (no priceAmount)", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/admin/content/courses")
        .set(auth(adminToken))
        .send({ categoryId, title: `Free Course ${suffix}` })
        .expect(201);
      freeCourseId = created.body.data.id;
      createdCourseIds.push(freeCourseId);
      expect(created.body.data.priceAmount).toBeNull();

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/content/courses/${freeCourseId}/status`)
        .set(auth(adminToken))
        .send({ status: "PUBLISHED" })
        .expect(200);
    });
  });

  describe("Entitlement gating over HTTP", () => {
    it("blocks curriculum access to a paid course before purchase", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/catalog/courses/${paidCourseId}/curriculum`)
        .set(auth(studentToken))
        .expect(403);
    });

    it("refuses free self-enrollment into a paid course", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/courses/${paidCourseId}/enroll`)
        .set(auth(studentToken))
        .expect(400);
    });

    it("allows free self-enrollment and immediate curriculum access for a free course", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/courses/${freeCourseId}/enroll`)
        .set(auth(studentToken))
        .expect(201);
      expect(res.body.data.status).toBe("ACTIVE");
      expect(res.body.data.source).toBe("FREE");

      await request(app.getHttpServer())
        .get(`/api/v1/catalog/courses/${freeCourseId}/curriculum`)
        .set(auth(studentToken))
        .expect(200);
    });
  });

  let orderId: string;
  let gatewayOrderId: string;

  describe("Purchase flow: checkout -> webhook -> entitlement", () => {
    it("starts checkout for the paid course", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/commerce/orders")
        .set(auth(studentToken))
        .send({ courseId: paidCourseId })
        .expect(201);
      orderId = res.body.data.order.id;
      gatewayOrderId = res.body.data.gatewayOrderId;
      createdOrderIds.push(orderId);
      expect(res.body.data.order.status).toBe("PENDING");
      expect(res.body.data.amount).toBe(1999);
      expect(res.body.data.gateway).toBe("RAZORPAY");
    });

    it("refuses checkout for a free course", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/commerce/orders")
        .set(auth(studentToken))
        .send({ courseId: freeCourseId })
        .expect(400);
    });

    it("rejects a webhook with an invalid signature", async () => {
      const body = JSON.stringify({
        gatewayOrderId,
        gatewayPaymentId: `bad_${suffix}`,
        event: "payment.captured",
      });
      await request(app.getHttpServer())
        .post("/api/v1/commerce/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", "not-a-real-signature")
        .send(body)
        .expect(401);
    });

    it("a correctly-signed webhook marks the order PAID, grants entitlement, and issues an invoice", async () => {
      const event = {
        gatewayOrderId,
        gatewayPaymentId: `pay_${suffix}`,
        event: "payment.captured",
      };
      const { rawBody, signature } = FakePaymentGatewayService.sign(event);

      await request(app.getHttpServer())
        .post("/api/v1/commerce/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(rawBody)
        .expect(200);

      const order = await request(app.getHttpServer())
        .get(`/api/v1/commerce/orders/${orderId}`)
        .set(auth(studentToken))
        .expect(200);
      expect(order.body.data.status).toBe("PAID");
      expect(order.body.data.invoice).toBeDefined();
      expect(order.body.data.invoice.amount).toBe(1999);
      expect(order.body.data.payments).toHaveLength(1);
      expect(order.body.data.payments[0].status).toBe("CAPTURED");

      await request(app.getHttpServer())
        .get(`/api/v1/catalog/courses/${paidCourseId}/curriculum`)
        .set(auth(studentToken))
        .expect(200);

      const enrollments = await request(app.getHttpServer())
        .get("/api/v1/enrollments")
        .set(auth(studentToken))
        .expect(200);
      const grant = enrollments.body.data.items.find(
        (e: { courseId: string }) => e.courseId === paidCourseId,
      );
      expect(grant?.status).toBe("ACTIVE");
      expect(grant?.source).toBe("PURCHASE");
    });

    it("a replayed webhook for the same payment is idempotent (no duplicate invoice)", async () => {
      const event = {
        gatewayOrderId,
        gatewayPaymentId: `pay_${suffix}`,
        event: "payment.captured",
      };
      const { rawBody, signature } = FakePaymentGatewayService.sign(event);

      await request(app.getHttpServer())
        .post("/api/v1/commerce/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(rawBody)
        .expect(200);

      const invoiceCount = await prisma.invoice.count({ where: { orderId } });
      expect(invoiceCount).toBe(1);
    });

    it("appears in the student's payment and invoice history", async () => {
      const payments = await request(app.getHttpServer())
        .get("/api/v1/commerce/payments")
        .set(auth(studentToken))
        .expect(200);
      expect(
        payments.body.data.items.some((p: { status: string }) => p.status === "CAPTURED"),
      ).toBe(true);

      const invoices = await request(app.getHttpServer())
        .get("/api/v1/commerce/invoices")
        .set(auth(studentToken))
        .expect(200);
      expect(invoices.body.data.items.length).toBeGreaterThan(0);
    });

    it("blocks a second checkout while already actively enrolled", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/commerce/orders")
        .set(auth(studentToken))
        .send({ courseId: paidCourseId })
        .expect(409);
    });
  });

  describe("Coupon-discounted checkout", () => {
    let couponId: string;
    const couponCode = `S8-FIXED-${suffix}`;

    it("admin creates a fixed-amount coupon", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/admin/commerce/coupons")
        .set(auth(adminToken))
        .send({ code: couponCode, discountType: "FIXED", discountValue: 300 })
        .expect(201);
      couponId = res.body.data.id;
      expect(res.body.data.redemptionCount).toBe(0);
    });

    it("rejects an unknown coupon code at checkout", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/commerce/orders")
        .set(auth(student2Token))
        .send({ courseId: couponCourseId, couponCode: `NOPE-${suffix}` })
        .expect(400);
    });

    it("applies the coupon's discount to the order total", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/commerce/orders")
        .set(auth(student2Token))
        .send({ courseId: couponCourseId, couponCode })
        .expect(201);
      createdOrderIds.push(res.body.data.order.id);
      expect(res.body.data.order.subtotalAmount).toBe(1200);
      expect(res.body.data.order.discountAmount).toBe(300);
      expect(res.body.data.order.totalAmount).toBe(900);
      expect(res.body.data.amount).toBe(900);

      const event = {
        gatewayOrderId: res.body.data.gatewayOrderId,
        gatewayPaymentId: `pay_coupon_${suffix}`,
        event: "payment.captured",
      };
      const { rawBody, signature } = FakePaymentGatewayService.sign(event);
      await request(app.getHttpServer())
        .post("/api/v1/commerce/payments/webhook")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", signature)
        .send(rawBody)
        .expect(200);
    });

    it("increments the coupon's redemption count only after the order is PAID", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/commerce/coupons/${couponId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.redemptionCount).toBe(1);
    });
  });

  describe("Refund request -> review -> process", () => {
    let refundId: string;

    it("a non-owner cannot request a refund on someone else's order", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/commerce/refunds")
        .set(auth(student2Token))
        .send({ orderId, reason: "Not mine" })
        .expect(404);
    });

    it("the owner requests a refund on their paid order", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/commerce/refunds")
        .set(auth(studentToken))
        .send({ orderId, reason: "Changed my mind" })
        .expect(201);
      refundId = res.body.data.id;
      expect(res.body.data.status).toBe("REQUESTED");
    });

    it("a student cannot review or process a refund", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/commerce/refunds/${refundId}/review`)
        .set(auth(studentToken))
        .send({ status: "APPROVED" })
        .expect(403);
    });

    it("admin approves the refund", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/commerce/refunds/${refundId}/review`)
        .set(auth(adminToken))
        .send({ status: "APPROVED" })
        .expect(200);
      expect(res.body.data.status).toBe("APPROVED");
    });

    it("admin processes the refund, revoking the enrollment and marking the order REFUNDED", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/commerce/refunds/${refundId}/process`)
        .set(auth(adminToken))
        .expect(201);
      expect(res.body.data.status).toBe("PROCESSED");

      const order = await request(app.getHttpServer())
        .get(`/api/v1/admin/commerce/orders/${orderId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(order.body.data.status).toBe("REFUNDED");

      // Entitlement gate re-engages immediately.
      await request(app.getHttpServer())
        .get(`/api/v1/catalog/courses/${paidCourseId}/curriculum`)
        .set(auth(studentToken))
        .expect(403);
    });

    it("refuses to refund an order that is no longer PAID", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/commerce/refunds")
        .set(auth(studentToken))
        .send({ orderId, reason: "Again?" })
        .expect(400);
    });
  });

  describe("Admin enrollment management", () => {
    let enrollmentId: string;

    it("manually re-grants access after the refund revoked it", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/admin/enrollments")
        .set(auth(adminToken))
        .send({ userId: studentId, courseId: paidCourseId })
        .expect(201);
      enrollmentId = res.body.data.id;
      expect(res.body.data.status).toBe("ACTIVE");
      expect(res.body.data.source).toBe("ADMIN_GRANT");

      await request(app.getHttpServer())
        .get(`/api/v1/catalog/courses/${paidCourseId}/curriculum`)
        .set(auth(studentToken))
        .expect(200);
    });

    it("lists the enrollment cross-student in the admin view", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/enrollments?courseId=${paidCourseId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data.items.some((e: { id: string }) => e.id === enrollmentId)).toBe(true);
    });

    it("revokes the enrollment, and the gate blocks access again", async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/admin/enrollments/${enrollmentId}`)
        .set(auth(adminToken))
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/v1/catalog/courses/${paidCourseId}/curriculum`)
        .set(auth(studentToken))
        .expect(403);
    });
  });

  describe("Admin order monitoring", () => {
    it("lists all orders across students, filterable by status", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/commerce/orders?status=PAID&pageSize=100")
        .set(auth(adminToken))
        .expect(200);
      expect(
        res.body.data.items.some((o: { courseId: string }) => o.courseId === couponCourseId),
      ).toBe(true);
    });
  });
});
