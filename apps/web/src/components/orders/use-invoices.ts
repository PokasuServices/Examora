"use client";

import * as React from "react";
import type { InvoiceSummary } from "@examora/types";
import { useCommerceApi } from "@/lib/commerce-api";

type Status = "loading" | "ready" | "error";

export function useInvoices() {
  const api = useCommerceApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [invoices, setInvoices] = React.useState<InvoiceSummary[]>([]);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listMyInvoices()
      .then((res) => {
        setInvoices(
          [...res.items].sort(
            (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
          ),
        );
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return { status, invoices, retry: load };
}
