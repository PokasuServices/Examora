"use client";

import * as React from "react";
import type { CmsWorkflowStatus, PaginatedData } from "@examora/types";

type Status = "loading" | "ready" | "error";
export type CmsStatusFilter = "ALL" | CmsWorkflowStatus;

const PAGE_SIZE = 15;

/** Generic paginated list over any of the four CMS content-type endpoints — all share page/pageSize/status server-side. */
export function useCmsList<T>(
  listFn: (params: {
    page: number;
    pageSize: number;
    status?: CmsWorkflowStatus;
  }) => Promise<PaginatedData<T>>,
) {
  const [status, setStatus] = React.useState<Status>("loading");
  const [items, setItems] = React.useState<T[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<CmsStatusFilter>("ALL");

  const load = React.useCallback(() => {
    setStatus("loading");
    listFn({ page, pageSize: PAGE_SIZE, status: statusFilter === "ALL" ? undefined : statusFilter })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    status,
    items,
    total,
    page,
    pageCount,
    setPage,
    statusFilter,
    setStatusFilter,
    retry: load,
  };
}
