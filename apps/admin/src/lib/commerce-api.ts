"use client";

import { useAuth } from "@examora/auth-client";
import type {
  Coupon,
  CouponDiscountType,
  Enrollment,
  EnrollmentStatus,
  OrderDetail,
  OrderStatus,
  PaginatedData,
  RefundStatus,
  RefundSummary,
} from "@examora/types";

const BASE = "/admin/commerce";

/** Typed wrappers over the admin enrollment/commerce endpoints (ADR-0018). */
export function useCommerceAdminApi() {
  const { request } = useAuth();

  return {
    // Enrollments (admin/enrollments — not under /admin/commerce, ADR-0018)
    listEnrollments: (params?: {
      userId?: string;
      courseId?: string;
      status?: EnrollmentStatus;
    }) => {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (params?.userId) qs.set("userId", params.userId);
      if (params?.courseId) qs.set("courseId", params.courseId);
      if (params?.status) qs.set("status", params.status);
      return request<PaginatedData<Enrollment>>(`/admin/enrollments?${qs.toString()}`, {
        method: "GET",
      });
    },
    grantEnrollment: (userId: string, courseId: string) =>
      request<Enrollment>("/admin/enrollments", { method: "POST", body: { userId, courseId } }),
    revokeEnrollment: (id: string) =>
      request<void>(`/admin/enrollments/${id}`, { method: "DELETE" }),

    // Coupons
    listCoupons: () =>
      request<PaginatedData<Coupon>>(`${BASE}/coupons?pageSize=100`, { method: "GET" }),
    createCoupon: (body: {
      code: string;
      discountType: CouponDiscountType;
      discountValue: number;
      maxRedemptions?: number;
      validFrom?: string;
      validUntil?: string;
    }) => request<Coupon>(`${BASE}/coupons`, { method: "POST", body }),
    updateCoupon: (id: string, body: Partial<{ isActive: boolean; maxRedemptions: number }>) =>
      request<Coupon>(`${BASE}/coupons/${id}`, { method: "PATCH", body }),

    // Orders
    listOrders: (params?: { status?: OrderStatus; userId?: string }) => {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (params?.status) qs.set("status", params.status);
      if (params?.userId) qs.set("userId", params.userId);
      return request<PaginatedData<OrderDetail>>(`${BASE}/orders?${qs.toString()}`, {
        method: "GET",
      });
    },
    getOrder: (id: string) => request<OrderDetail>(`${BASE}/orders/${id}`, { method: "GET" }),

    // Refunds
    listRefunds: (status?: RefundStatus) => {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (status) qs.set("status", status);
      return request<PaginatedData<RefundSummary>>(`${BASE}/refunds?${qs.toString()}`, {
        method: "GET",
      });
    },
    reviewRefund: (id: string, status: "APPROVED" | "DENIED") =>
      request<RefundSummary>(`${BASE}/refunds/${id}/review`, { method: "PATCH", body: { status } }),
    processRefund: (id: string) =>
      request<RefundSummary>(`${BASE}/refunds/${id}/process`, { method: "POST" }),
  };
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
}
