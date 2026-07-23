import { Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import type { Prisma } from "@examora/database";
import { AuditService } from "../../audit/audit.service";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CouponsService } from "../coupons/coupons.service";
import { PAYMENT_GATEWAY_PORT, type PaymentGatewayPort } from "../payment-gateway.port";

const SUCCESS_EVENTS = new Set(["payment.captured", "order.paid"]);
const FAILURE_EVENTS = new Set(["payment.failed"]);

/**
 * Only a verified webhook can move a Payment/Order to a paid state — a
 * client-side callback is never trusted (SRS-02 Table 6, ADR-0018).
 * Idempotent by gatewayPaymentId: a duplicate or forged-but-valid-looking
 * replay for an already-processed payment is a no-op.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentService: EnrollmentService,
    private readonly couponsService: CouponsService,
    private readonly auditService: AuditService,
    @Inject(PAYMENT_GATEWAY_PORT) private readonly gateway: PaymentGatewayPort,
  ) {}

  async handleWebhook(
    rawBody: Buffer | string,
    signatureHeader: string | undefined,
  ): Promise<void> {
    if (!signatureHeader || !this.gateway.verifyWebhookSignature(rawBody, signatureHeader)) {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    const event = this.gateway.parseWebhookEvent(rawBody);
    const payment = await this.prisma.payment.findFirst({
      where: { gatewayOrderId: event.gatewayOrderId },
      include: { order: { include: { coupon: true } } },
    });
    if (!payment) {
      this.logger.warn(`Webhook for unknown gateway order ${event.gatewayOrderId}`);
      return;
    }

    // Idempotent: this exact payment has already been finalized.
    if (payment.gatewayPaymentId === event.gatewayPaymentId && payment.status !== "CREATED") {
      return;
    }

    if (SUCCESS_EVENTS.has(event.event)) {
      await this.markCaptured(payment.id, event.gatewayPaymentId, payment.order);
    } else if (FAILURE_EVENTS.has(event.event)) {
      await this.markFailed(payment.id, event.gatewayPaymentId, payment.orderId);
    } else {
      this.logger.warn(`Unhandled webhook event type: ${event.event}`);
    }
  }

  private async markCaptured(
    paymentId: string,
    gatewayPaymentId: string,
    order: Prisma.OrderGetPayload<{ include: { coupon: true } }>,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: paymentId },
        data: { gatewayPaymentId, status: "CAPTURED", verifiedAt: new Date() },
      }),
      this.prisma.order.update({ where: { id: order.id }, data: { status: "PAID" } }),
    ]);

    await this.enrollmentService.grantFromOrder(order.userId, order.courseId, order.id);
    if (order.couponId) {
      await this.couponsService.recordRedemption(order.couponId);
    }
    await this.issueInvoice(order.id, Number(order.totalAmount), order.currency);

    await this.auditService.record({
      action: "commerce.payment_captured",
      entityType: "Order",
      entityId: order.id,
      after: { userId: order.userId, courseId: order.courseId, amount: Number(order.totalAmount) },
    });
  }

  private async markFailed(
    paymentId: string,
    gatewayPaymentId: string,
    orderId: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: paymentId },
        data: { gatewayPaymentId, status: "FAILED" },
      }),
      this.prisma.order.update({ where: { id: orderId }, data: { status: "FAILED" } }),
    ]);
    await this.auditService.record({
      action: "commerce.payment_failed",
      entityType: "Order",
      entityId: orderId,
    });
  }

  private async issueInvoice(orderId: string, amount: number, currency: string): Promise<void> {
    const count = await this.prisma.invoice.count();
    const invoiceNumber = `INV-${String(count + 1).padStart(6, "0")}`;
    await this.prisma.invoice.create({
      data: { orderId, invoiceNumber, amount, currency },
    });
  }

  async listMine(userId: string, params: { page: number; pageSize: number }) {
    const where: Prisma.PaymentWhereInput = { order: { userId } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, total };
  }
}
