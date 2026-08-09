"use client";

import * as React from "react";
import type { RefundSummary } from "@examora/types";
import { useCommerceApi } from "@/lib/commerce-api";

type Status = "loading" | "ready" | "error";

export interface RefundWithCourse extends RefundSummary {
  courseTitle: string | null;
  /** RefundSummary carries no currency of its own — read from the matching order, never assumed. */
  currency: string | null;
}

/** Cross-references /commerce/refunds with /commerce/orders (by orderId) purely to surface the real course title and currency — no new endpoint. */
export function useRefunds() {
  const api = useCommerceApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [refunds, setRefunds] = React.useState<RefundWithCourse[]>([]);

  const load = React.useCallback(() => {
    setStatus("loading");
    Promise.all([api.listMyRefunds(), api.listMyOrders()])
      .then(([refundsRes, ordersRes]) => {
        const orderById = new Map(ordersRes.items.map((o) => [o.id, o]));
        const merged = refundsRes.items.map((refund) => ({
          ...refund,
          courseTitle: orderById.get(refund.orderId)?.courseTitle ?? null,
          currency: orderById.get(refund.orderId)?.currency ?? null,
        }));
        merged.sort(
          (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
        );
        setRefunds(merged);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return { status, refunds, retry: load };
}
