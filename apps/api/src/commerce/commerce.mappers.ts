import type {
  Coupon as CouponDto,
  InvoiceSummary,
  OrderDetail,
  OrderSummary,
  PaymentSummary,
  RefundSummary,
} from "@examora/types";

type CouponRow = {
  id: string;
  code: string;
  discountType: string;
  discountValue: unknown;
  maxRedemptions: number | null;
  redemptionCount: number;
  validFrom: Date | null;
  validUntil: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toCoupon(row: CouponRow): CouponDto {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discountType as CouponDto["discountType"],
    discountValue: Number(row.discountValue),
    maxRedemptions: row.maxRedemptions,
    redemptionCount: row.redemptionCount,
    validFrom: row.validFrom ? row.validFrom.toISOString() : null,
    validUntil: row.validUntil ? row.validUntil.toISOString() : null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type OrderSummaryRow = {
  id: string;
  courseId: string;
  status: string;
  subtotalAmount: unknown;
  discountAmount: unknown;
  totalAmount: unknown;
  currency: string;
  createdAt: Date;
  course: { title: string };
  coupon: { code: string } | null;
};

export function toOrderSummary(row: OrderSummaryRow): OrderSummary {
  return {
    id: row.id,
    courseId: row.courseId,
    courseTitle: row.course.title,
    status: row.status as OrderSummary["status"],
    subtotalAmount: Number(row.subtotalAmount),
    discountAmount: Number(row.discountAmount),
    totalAmount: Number(row.totalAmount),
    currency: row.currency,
    couponCode: row.coupon?.code ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

type PaymentSummaryRow = {
  id: string;
  gateway: string;
  gatewayOrderId: string;
  gatewayPaymentId: string | null;
  status: string;
  amount: unknown;
  currency: string;
  verifiedAt: Date | null;
  createdAt: Date;
};

export function toPaymentSummary(row: PaymentSummaryRow): PaymentSummary {
  return {
    id: row.id,
    gateway: row.gateway as PaymentSummary["gateway"],
    gatewayOrderId: row.gatewayOrderId,
    gatewayPaymentId: row.gatewayPaymentId,
    status: row.status as PaymentSummary["status"],
    amount: Number(row.amount),
    currency: row.currency,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

type InvoiceSummaryRow = {
  id: string;
  invoiceNumber: string;
  amount: unknown;
  currency: string;
  issuedAt: Date;
};

export function toInvoiceSummary(row: InvoiceSummaryRow): InvoiceSummary {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    amount: Number(row.amount),
    currency: row.currency,
    issuedAt: row.issuedAt.toISOString(),
  };
}

type OrderDetailRow = OrderSummaryRow & {
  userId: string;
  user: { email: string };
  payments: PaymentSummaryRow[];
  invoice: InvoiceSummaryRow | null;
};

export function toOrderDetail(row: OrderDetailRow): OrderDetail {
  return {
    ...toOrderSummary(row),
    userId: row.userId,
    userEmail: row.user.email,
    payments: row.payments.map(toPaymentSummary),
    invoice: row.invoice ? toInvoiceSummary(row.invoice) : null,
  };
}

type RefundSummaryRow = {
  id: string;
  orderId: string;
  status: string;
  amount: unknown;
  reason: string;
  requestedById: string;
  reviewedById: string | null;
  requestedAt: Date;
  reviewedAt: Date | null;
  requestedBy: { email: string };
  reviewedBy: { email: string } | null;
};

export function toRefundSummary(row: RefundSummaryRow): RefundSummary {
  return {
    id: row.id,
    orderId: row.orderId,
    status: row.status as RefundSummary["status"],
    amount: Number(row.amount),
    reason: row.reason,
    requestedById: row.requestedById,
    requestedByEmail: row.requestedBy.email,
    reviewedById: row.reviewedById,
    reviewedByEmail: row.reviewedBy?.email ?? null,
    requestedAt: row.requestedAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
  };
}
