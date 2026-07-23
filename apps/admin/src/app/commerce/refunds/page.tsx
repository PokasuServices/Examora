"use client";

import * as React from "react";
import Link from "next/link";
import { ApiError } from "@examora/auth-client";
import type { RefundStatus, RefundSummary } from "@examora/types";
import { Button, FieldError } from "@examora/ui";
import { CommerceNav } from "@/components/commerce-nav";
import { RequirePermission } from "@/components/require-permission";
import { formatMoney, useCommerceAdminApi } from "@/lib/commerce-api";

const STATUS_FILTERS: (RefundStatus | "ALL")[] = [
  "ALL",
  "REQUESTED",
  "APPROVED",
  "DENIED",
  "PROCESSED",
];

function RefundsContent() {
  const api = useCommerceAdminApi();
  const [refunds, setRefunds] = React.useState<RefundSummary[]>([]);
  const [filter, setFilter] = React.useState<RefundStatus | "ALL">("REQUESTED");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .listRefunds(filter === "ALL" ? undefined : filter)
      .then((res) => setRefunds(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function review(id: string, status: "APPROVED" | "DENIED"): Promise<void> {
    setError(null);
    try {
      await api.reviewRefund(id, status);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not review the refund");
    }
  }

  async function process(id: string): Promise<void> {
    setError(null);
    try {
      await api.processRefund(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not process the refund");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <CommerceNav />
      <h1 className="text-heading">Refund requests</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-md px-3 py-1 text-sm ${
              filter === s ? "bg-primary-600 text-white" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <FieldError>{error}</FieldError>

      <ul className="mt-4 flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {refunds.map((refund) => (
          <li key={refund.id} className="flex items-center justify-between gap-3 px-4 py-4 text-sm">
            <div>
              <Link
                href={`/commerce/orders/${refund.orderId}`}
                className="font-medium text-primary-600 hover:underline"
              >
                Order {refund.orderId.slice(0, 8)}…
              </Link>
              <p className="mt-1 text-neutral-600">{refund.reason}</p>
              <p className="mt-1 text-xs text-neutral-400">
                {refund.requestedByEmail} · {formatMoney(refund.amount, "INR")} ·{" "}
                {new Date(refund.requestedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                {refund.status}
              </span>
              {refund.status === "REQUESTED" ? (
                <>
                  <Button variant="secondary" onClick={() => void review(refund.id, "APPROVED")}>
                    Approve
                  </Button>
                  <Button variant="ghost" onClick={() => void review(refund.id, "DENIED")}>
                    Deny
                  </Button>
                </>
              ) : null}
              {refund.status === "APPROVED" ? (
                <Button onClick={() => void process(refund.id)}>Process</Button>
              ) : null}
            </div>
          </li>
        ))}
        {refunds.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-neutral-500">No refund requests.</li>
        ) : null}
      </ul>
    </main>
  );
}

export default function RefundsPage() {
  return (
    <RequirePermission permission="commerce:manage">
      <RefundsContent />
    </RequirePermission>
  );
}
