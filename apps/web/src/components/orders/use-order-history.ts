"use client";

import * as React from "react";
import type { OrderStatus, OrderSummary } from "@examora/types";
import { useCommerceApi } from "@/lib/commerce-api";

type Status = "loading" | "ready" | "error";
export type StatusFilter = "ALL" | OrderStatus;
export type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

const PAGE_SIZE = 10;

/**
 * /commerce/orders only supports page/pageSize server-side (no search, filter,
 * or sort params) — same "fetch a bounded batch once, filter/sort/paginate
 * client-side" pattern already used for Notification Center and Community
 * Boards, not a new capability invented for this page.
 */
export function useOrderHistory() {
  const api = useCommerceApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [orders, setOrders] = React.useState<OrderSummary[]>([]);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");
  const [sortKey, setSortKey] = React.useState<SortKey>("date-desc");
  const [page, setPage] = React.useState(1);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listMyOrders()
      .then((res) => {
        setOrders(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [query, statusFilter, sortKey]);

  const filtered = React.useMemo(() => {
    let result = orders;
    if (statusFilter !== "ALL") {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter((o) => o.courseTitle.toLowerCase().includes(q));
    }
    const sorted = [...result];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "date-asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "amount-desc":
          return b.totalAmount - a.totalAmount;
        case "amount-asc":
          return a.totalAmount - b.totalAmount;
        case "date-desc":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return sorted;
  }, [orders, query, statusFilter, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  return {
    status,
    pageItems,
    filteredCount: filtered.length,
    totalCount: orders.length,
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    sortKey,
    setSortKey,
    page: clampedPage,
    pageCount,
    setPage,
    retry: load,
  };
}
