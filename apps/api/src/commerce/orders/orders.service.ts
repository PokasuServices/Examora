import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@examora/database";
import type { OrderStatus } from "@examora/types";
import type { AppConfig } from "../../config/configuration";
import { EnrollmentService } from "../../enrollment/enrollment.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CouponsService } from "../coupons/coupons.service";
import { PAYMENT_GATEWAY_PORT, type PaymentGatewayPort } from "../payment-gateway.port";

const ORDER_SUMMARY_INCLUDE = {
  course: { select: { title: true } },
  coupon: { select: { code: true } },
} as const;

const ORDER_DETAIL_INCLUDE = {
  ...ORDER_SUMMARY_INCLUDE,
  user: { select: { email: true } },
  payments: { orderBy: { createdAt: "asc" as const } },
  invoice: true,
} as const;

/**
 * Checkout creates a PENDING Order + a CREATED Payment against the gateway —
 * only a verified webhook (PaymentsService) ever moves either to a paid
 * state (ADR-0018). A single course per order (no cart/bundle model yet).
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly couponsService: CouponsService,
    private readonly enrollmentService: EnrollmentService,
    private readonly configService: ConfigService,
    @Inject(PAYMENT_GATEWAY_PORT) private readonly gateway: PaymentGatewayPort,
  ) {}

  async checkout(userId: string, courseId: string, couponCode?: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, deletedAt: null, status: "PUBLISHED" },
      select: { id: true, priceAmount: true, priceCurrency: true },
    });
    if (!course) {
      throw new NotFoundException("Course not found");
    }
    if (course.priceAmount === null) {
      throw new BadRequestException(
        "This course is free — enroll directly instead of checking out",
      );
    }

    const existing = await this.enrollmentService.getActiveEnrollment(userId, courseId);
    if (existing?.status === "ACTIVE") {
      throw new ConflictException("You are already enrolled in this course");
    }

    const subtotal = Number(course.priceAmount);
    let discountAmount = 0;
    let couponId: string | undefined;
    if (couponCode) {
      const result = await this.couponsService.validateForCheckout(couponCode, subtotal);
      discountAmount = result.discountAmount;
      couponId = result.coupon.id;
    }
    const totalAmount = Math.max(subtotal - discountAmount, 0);

    const order = await this.prisma.order.create({
      data: {
        userId,
        courseId,
        couponId,
        status: "PENDING",
        subtotalAmount: subtotal,
        discountAmount,
        totalAmount,
        currency: course.priceCurrency,
      },
      include: ORDER_SUMMARY_INCLUDE,
    });

    const gatewayOrder = await this.gateway.createOrder({
      amount: totalAmount,
      currency: course.priceCurrency,
      receipt: order.id,
    });
    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        gatewayOrderId: gatewayOrder.gatewayOrderId,
        amount: totalAmount,
        currency: course.priceCurrency,
        status: "CREATED",
      },
    });

    return {
      order,
      gatewayOrderId: gatewayOrder.gatewayOrderId,
      gatewayKeyId: this.configService.getOrThrow<AppConfig>("app").payments.razorpay.keyId,
      amount: totalAmount,
      currency: course.priceCurrency,
    };
  }

  async listMine(userId: string, params: { page: number; pageSize: number }) {
    const where: Prisma.OrderWhereInput = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: ORDER_SUMMARY_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total };
  }

  async getMineOrThrow(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: ORDER_DETAIL_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  async getByIdOrThrow(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_DETAIL_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  async listAll(params: { page: number; pageSize: number; userId?: string; status?: OrderStatus }) {
    const where: Prisma.OrderWhereInput = {
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.status ? { status: params.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: ORDER_DETAIL_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total };
  }
}
