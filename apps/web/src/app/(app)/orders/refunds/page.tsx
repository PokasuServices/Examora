"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { OrdersShell } from "@/components/orders/orders-shell";
import { useRefunds } from "@/components/orders/use-refunds";
import { refundStatusTone, shortOrderId, statusLabel } from "@/components/orders/format";
import { formatMoney } from "@/lib/commerce-api";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RefundsContent() {
  const { status, refunds, retry } = useRefunds();

  if (status === "loading") {
    return (
      <Card>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card>
        <RetryInline message="Couldn't load your refunds" onRetry={retry} />
      </Card>
    );
  }

  if (refunds.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={RotateCcw}
          heading="No refund requests"
          body="If you request a refund on an order, you'll be able to track it here."
          actionLabel="View order history"
          actionHref="/orders/history"
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {refunds.map((refund) => (
        <Card key={refund.id}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                href={`/orders/${refund.orderId}`}
                className="font-medium text-primary-700 hover:underline"
              >
                {refund.courseTitle ?? shortOrderId(refund.orderId)}
              </Link>
              <p className="mt-0.5 text-xs text-neutral-500">
                {shortOrderId(refund.orderId)}
                {refund.currency ? ` · ${formatMoney(refund.amount, refund.currency)}` : ""}
              </p>
            </div>
            <Chip tone={refundStatusTone(refund.status)}>{statusLabel(refund.status)}</Chip>
          </div>

          <p className="mt-3 text-sm text-neutral-700">{refund.reason}</p>

          <div className="mt-4 flex flex-col gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
            <p>Requested {formatDate(refund.requestedAt)}</p>
            {refund.reviewedAt ? (
              <p>
                {statusLabel(refund.status)} {formatDate(refund.reviewedAt)}
                {refund.reviewedByEmail ? ` by ${refund.reviewedByEmail}` : ""}
              </p>
            ) : (
              <p>Awaiting review</p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function RefundsPage() {
  return (
    <RequireAuth>
      <OrdersShell>
        <RefundsContent />
      </OrdersShell>
    </RequireAuth>
  );
}
