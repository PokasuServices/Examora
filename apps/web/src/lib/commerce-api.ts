"use client";

import { useAuth } from "@examora/auth-client";
import type {
  CheckoutSession,
  Enrollment,
  InvoiceSummary,
  OrderDetail,
  OrderSummary,
  PaginatedData,
  PaymentSummary,
  RefundSummary,
} from "@examora/types";

/** Typed wrappers over the student-facing enrollment/commerce endpoints (ADR-0018). */
export function useCommerceApi() {
  const { request } = useAuth();

  return {
    listMyEnrollments: () =>
      request<PaginatedData<Enrollment>>("/enrollments?pageSize=100", { method: "GET" }),
    enrollFree: (courseId: string) =>
      request<Enrollment>(`/courses/${courseId}/enroll`, { method: "POST" }),

    checkout: (courseId: string, couponCode?: string) =>
      request<CheckoutSession>("/commerce/orders", {
        method: "POST",
        body: { courseId, ...(couponCode ? { couponCode } : {}) },
      }),
    listMyOrders: () =>
      request<PaginatedData<OrderSummary>>("/commerce/orders?pageSize=100", { method: "GET" }),
    getMyOrder: (id: string) => request<OrderDetail>(`/commerce/orders/${id}`, { method: "GET" }),

    listMyPayments: () =>
      request<PaginatedData<PaymentSummary>>("/commerce/payments?pageSize=100", { method: "GET" }),
    listMyInvoices: () =>
      request<PaginatedData<InvoiceSummary>>("/commerce/invoices?pageSize=100", { method: "GET" }),

    requestRefund: (orderId: string, reason: string) =>
      request<RefundSummary>("/commerce/refunds", { method: "POST", body: { orderId, reason } }),
    listMyRefunds: () =>
      request<PaginatedData<RefundSummary>>("/commerce/refunds?pageSize=100", { method: "GET" }),
  };
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
}
