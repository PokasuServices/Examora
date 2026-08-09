"use client";

import * as React from "react";
import type { Enrollment, OrderSummary } from "@examora/types";
import { useCommerceApi } from "@/lib/commerce-api";

type Status = "loading" | "ready" | "error";

/** Overview cards + Recent Orders — both derived client-side from the same two bounded list fetches, no new endpoints. */
export function useOrdersDashboard() {
  const api = useCommerceApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [orders, setOrders] = React.useState<OrderSummary[]>([]);
  const [enrollments, setEnrollments] = React.useState<Enrollment[]>([]);

  const load = React.useCallback(() => {
    setStatus("loading");
    Promise.all([api.listMyOrders(), api.listMyEnrollments()])
      .then(([ordersRes, enrollmentsRes]) => {
        setOrders(ordersRes.items);
        setEnrollments(enrollmentsRes.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const totalPurchases = orders.length;
  const activeCourses = enrollments.filter((e) => e.status === "ACTIVE").length;
  const completedPurchases = orders.filter((o) => o.status === "PAID").length;
  const pendingOrders = orders.filter((o) => o.status === "PENDING").length;

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return {
    status,
    totalPurchases,
    activeCourses,
    completedPurchases,
    pendingOrders,
    recentOrders,
    hasAnyOrders: orders.length > 0,
    retry: load,
  };
}
