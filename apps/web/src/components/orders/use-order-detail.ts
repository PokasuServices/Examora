"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { Enrollment, OrderDetail, RefundSummary } from "@examora/types";
import { useCommerceApi } from "@/lib/commerce-api";

type Status = "loading" | "ready" | "error" | "not-found";
type RefundRequestStatus = "idle" | "submitting" | "error";

export function useOrderDetail(orderId: string) {
  const api = useCommerceApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [order, setOrder] = React.useState<OrderDetail | null>(null);
  const [enrollment, setEnrollment] = React.useState<Enrollment | null>(null);
  const [refund, setRefund] = React.useState<RefundSummary | null>(null);
  const [refundRequestStatus, setRefundRequestStatus] = React.useState<RefundRequestStatus>("idle");
  const [refundRequestError, setRefundRequestError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    Promise.all([api.getMyOrder(orderId), api.listMyEnrollments(), api.listMyRefunds()])
      .then(([orderRes, enrollmentsRes, refundsRes]) => {
        setOrder(orderRes);
        setEnrollment(enrollmentsRes.items.find((e) => e.courseId === orderRes.courseId) ?? null);
        setRefund(refundsRes.items.find((r) => r.orderId === orderRes.id) ?? null);
        setStatus("ready");
      })
      .catch((err) => {
        setStatus(err instanceof ApiError && err.status === 404 ? "not-found" : "error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function requestRefund(reason: string): Promise<void> {
    setRefundRequestStatus("submitting");
    setRefundRequestError(null);
    try {
      const created = await api.requestRefund(orderId, reason);
      setRefund(created);
      setRefundRequestStatus("idle");
    } catch (err) {
      setRefundRequestStatus("error");
      setRefundRequestError(
        err instanceof ApiError ? err.message : "Could not submit the refund request.",
      );
    }
  }

  return {
    status,
    order,
    enrollment,
    refund,
    refundRequestStatus,
    refundRequestError,
    requestRefund,
    retry: load,
  };
}
