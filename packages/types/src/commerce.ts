// ---------------------------------------------------------------------------
// Enums (mirrored from Prisma as const arrays, per the PERMISSION_CODES
// convention elsewhere in this package)
// ---------------------------------------------------------------------------

/** A single current-access-state record per (user, course) — ADR-0018. */
export const ENROLLMENT_STATUSES = ["ACTIVE", "EXPIRED", "REVOKED"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const ENROLLMENT_SOURCES = ["FREE", "PURCHASE", "ADMIN_GRANT"] as const;
export type EnrollmentSource = (typeof ENROLLMENT_SOURCES)[number];

export const ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const COUPON_DISCOUNT_TYPES = ["PERCENTAGE", "FIXED"] as const;
export type CouponDiscountType = (typeof COUPON_DISCOUNT_TYPES)[number];

/** Gateway-agnostic (ADR-0018) — Razorpay is the only concrete adapter today. */
export const PAYMENT_GATEWAYS = ["RAZORPAY"] as const;
export type PaymentGateway = (typeof PAYMENT_GATEWAYS)[number];

export const PAYMENT_STATUSES = [
  "CREATED",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** A request/review state machine only — gateway-side settlement is deferred (TD-037). */
export const REFUND_STATUSES = ["REQUESTED", "APPROVED", "DENIED", "PROCESSED"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export interface Enrollment {
  id: string;
  userId: string;
  userEmail: string;
  courseId: string;
  courseTitle: string;
  status: EnrollmentStatus;
  source: EnrollmentSource;
  orderId: string | null;
  enrolledAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export interface Coupon {
  id: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Orders, Payments, Invoices
// ---------------------------------------------------------------------------

export interface OrderSummary {
  id: string;
  courseId: string;
  courseTitle: string;
  status: OrderStatus;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  couponCode: string | null;
  createdAt: string;
}

export interface PaymentSummary {
  id: string;
  gateway: PaymentGateway;
  gatewayOrderId: string;
  gatewayPaymentId: string | null;
  status: PaymentStatus;
  amount: number;
  currency: string;
  verifiedAt: string | null;
  createdAt: string;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  issuedAt: string;
}

export interface OrderDetail extends OrderSummary {
  userId: string;
  userEmail: string;
  payments: PaymentSummary[];
  invoice: InvoiceSummary | null;
}

/** Returned by checkout — everything the frontend needs to open the gateway's checkout widget. */
export interface CheckoutSession {
  order: OrderSummary;
  gateway: PaymentGateway;
  gatewayOrderId: string;
  gatewayKeyId: string;
  amount: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export interface RefundSummary {
  id: string;
  orderId: string;
  status: RefundStatus;
  amount: number;
  reason: string;
  requestedById: string;
  requestedByEmail: string;
  reviewedById: string | null;
  reviewedByEmail: string | null;
  requestedAt: string;
  reviewedAt: string | null;
}
