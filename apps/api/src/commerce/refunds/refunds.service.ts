import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@examora/database";
import type { RefundStatus } from "@examora/types";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { PrismaService } from "../../prisma/prisma.service";

const REFUND_INCLUDE = {
  requestedBy: { select: { email: true } },
  reviewedBy: { select: { email: true } },
} as const;

/**
 * A request/review state machine only (ADR-0018) — actual gateway-side
 * refund settlement is deferred (TD-037). Processing an approved refund
 * revokes the associated Enrollment and marks the Order REFUNDED.
 */
@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentService: EnrollmentService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async request(userId: string, orderId: string, reason: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    if (order.status !== "PAID") {
      throw new BadRequestException("Only a paid order can be refunded");
    }

    return this.prisma.refund.create({
      data: { orderId, requestedById: userId, reason, amount: order.totalAmount },
      include: REFUND_INCLUDE,
    });
  }

  async review(actorId: string, refundId: string, status: "APPROVED" | "DENIED") {
    const refund = await this.findByIdOrThrow(refundId);
    if (refund.status !== "REQUESTED") {
      throw new BadRequestException("Only a requested refund can be reviewed");
    }

    return this.prisma.refund.update({
      where: { id: refundId },
      data: { status, reviewedById: actorId, reviewedAt: new Date() },
      include: REFUND_INCLUDE,
    });
  }

  /** Marks an approved refund processed — revokes the enrollment and marks the order refunded. */
  async process(refundId: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { order: true },
    });
    if (!refund) {
      throw new NotFoundException("Refund not found");
    }
    if (refund.status !== "APPROVED") {
      throw new BadRequestException("Only an approved refund can be processed");
    }

    const isPartial = Number(refund.amount) < Number(refund.order.totalAmount);
    await this.prisma.$transaction([
      this.prisma.refund.update({ where: { id: refundId }, data: { status: "PROCESSED" } }),
      this.prisma.order.update({
        where: { id: refund.orderId },
        data: { status: isPartial ? "PARTIALLY_REFUNDED" : "REFUNDED" },
      }),
    ]);
    await this.enrollmentService.revokeForRefund(refund.order.userId, refund.order.courseId);

    await this.notificationsService.enqueue({
      userId: refund.order.userId,
      eventType: "commerce.refund_processed",
      category: "commerce",
      title: "Your refund has been processed",
      body: `A refund of ${refund.order.currency} ${Number(refund.amount).toFixed(2)} has been processed for your order.`,
      data: { orderId: refund.orderId, amount: Number(refund.amount) },
      channels: ["EMAIL"],
      isTransactional: true,
    });

    return this.findByIdOrThrow(refundId);
  }

  async findByIdOrThrow(id: string) {
    const refund = await this.prisma.refund.findUnique({ where: { id }, include: REFUND_INCLUDE });
    if (!refund) {
      throw new NotFoundException("Refund not found");
    }
    return refund;
  }

  async listMine(userId: string, params: { page: number; pageSize: number }) {
    const where: Prisma.RefundWhereInput = { requestedById: userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.refund.findMany({
        where,
        include: REFUND_INCLUDE,
        orderBy: { requestedAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.refund.count({ where }),
    ]);
    return { items, total };
  }

  async listAll(params: { page: number; pageSize: number; status?: RefundStatus }) {
    const where: Prisma.RefundWhereInput = {
      ...(params.status ? { status: params.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.refund.findMany({
        where,
        include: REFUND_INCLUDE,
        orderBy: { requestedAt: "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.refund.count({ where }),
    ]);
    return { items, total };
  }
}
