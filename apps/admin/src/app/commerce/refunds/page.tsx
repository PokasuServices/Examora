"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { RefundStatus, RefundSummary } from "@examora/types";
import { Button, FieldError } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { formatMoney, useCommerceAdminApi } from "@/lib/commerce-api";

const STATUS_FILTERS: (RefundStatus | "ALL")[] = [
  "ALL",
  "REQUESTED",
  "APPROVED",
  "DENIED",
  "PROCESSED",
];

const STATUS_TONE: Record<RefundStatus, ChipTone> = {
  REQUESTED: "warning",
  APPROVED: "primary",
  DENIED: "danger",
  PROCESSED: "success",
};

type PendingAction = { id: string; kind: "APPROVED" | "DENIED" | "PROCESS" } | null;

function RefundsContent() {
  const api = useCommerceAdminApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [refunds, setRefunds] = React.useState<RefundSummary[]>([]);
  const [filter, setFilter] = React.useState<RefundStatus | "ALL">("REQUESTED");
  const [pending, setPending] = React.useState<PendingAction>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listRefunds(filter === "ALL" ? undefined : filter)
      .then((res) => {
        setRefunds(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function confirmAction(): Promise<void> {
    if (!pending) return;
    setError(null);
    setSubmitting(true);
    try {
      if (pending.kind === "PROCESS") {
        await api.processRefund(pending.id);
      } else {
        await api.reviewRefund(pending.id, pending.kind);
      }
      setPending(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the refund");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Refund requests"
        subtitle="Review, approve, deny, or process student refund requests."
      />

      <Card density="compact">
        <div className="max-w-xs">
          <SelectField
            id="refund-status-filter"
            label="Status"
            value={filter}
            options={STATUS_FILTERS.map((s) => ({
              value: s,
              label: s === "ALL" ? "All statuses" : statusLabel(s),
            }))}
            onChange={(v) => setFilter(v as RefundStatus | "ALL")}
          />
        </div>
      </Card>
      <FieldError>{error}</FieldError>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load refund requests" onRetry={load} />
        ) : refunds.length === 0 ? (
          <EmptyState
            icon={RotateCcw}
            heading="No refund requests"
            body="Try a different status filter."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {refunds.map((refund) => (
              <li
                key={refund.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3.5"
              >
                <div className="min-w-0">
                  <Link
                    href={`/commerce/orders/${refund.orderId}`}
                    className="font-medium text-primary-600 hover:underline"
                  >
                    Order {refund.orderId.slice(0, 8)}…
                  </Link>
                  <p className="mt-1 text-sm text-neutral-600">{refund.reason}</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {refund.requestedByEmail} · {formatMoney(refund.amount, "INR")} ·{" "}
                    {new Date(refund.requestedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Chip tone={STATUS_TONE[refund.status]}>{statusLabel(refund.status)}</Chip>
                  {refund.status === "REQUESTED" ? (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => setPending({ id: refund.id, kind: "APPROVED" })}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setPending({ id: refund.id, kind: "DENIED" })}
                      >
                        Deny
                      </Button>
                    </>
                  ) : null}
                  {refund.status === "APPROVED" ? (
                    <Button onClick={() => setPending({ id: refund.id, kind: "PROCESS" })}>
                      Process
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === "PROCESS"
            ? "Process this refund?"
            : pending?.kind === "APPROVED"
              ? "Approve this refund?"
              : "Deny this refund?"
        }
        message={
          pending?.kind === "PROCESS"
            ? "This issues the refund through the payment gateway. This can't be undone."
            : pending?.kind === "APPROVED"
              ? "The student will be notified their refund was approved."
              : "The student will be notified their refund was denied."
        }
        confirmLabel={
          pending?.kind === "PROCESS"
            ? "Process"
            : pending?.kind === "APPROVED"
              ? "Approve"
              : "Deny"
        }
        tone={pending?.kind === "DENIED" ? "danger" : "primary"}
        submitting={submitting}
        error={error}
        onConfirm={() => void confirmAction()}
        onCancel={() => setPending(null)}
      />
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
