import type { EnrollmentStatus, OrderStatus, PaymentStatus, RefundStatus } from "@examora/types";
import type { ChipTone } from "@/components/ui/chip";

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

const ORDER_STATUS_TONE: Record<OrderStatus, ChipTone> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
  PARTIALLY_REFUNDED: "warning",
};

export function orderStatusTone(status: OrderStatus): ChipTone {
  return ORDER_STATUS_TONE[status];
}

const PAYMENT_STATUS_TONE: Record<PaymentStatus, ChipTone> = {
  CREATED: "neutral",
  AUTHORIZED: "warning",
  CAPTURED: "success",
  FAILED: "danger",
  REFUNDED: "neutral",
};

export function paymentStatusTone(status: PaymentStatus): ChipTone {
  return PAYMENT_STATUS_TONE[status];
}

const REFUND_STATUS_TONE: Record<RefundStatus, ChipTone> = {
  REQUESTED: "warning",
  APPROVED: "success",
  DENIED: "danger",
  PROCESSED: "success",
};

export function refundStatusTone(status: RefundStatus): ChipTone {
  return REFUND_STATUS_TONE[status];
}

const ENROLLMENT_STATUS_TONE: Record<EnrollmentStatus, ChipTone> = {
  ACTIVE: "success",
  EXPIRED: "neutral",
  REVOKED: "danger",
};

export function enrollmentStatusTone(status: EnrollmentStatus): ChipTone {
  return ENROLLMENT_STATUS_TONE[status];
}

/** Orders have no separate human-readable order number — this is the real id, shortened Stripe-style. */
export function shortOrderId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}
