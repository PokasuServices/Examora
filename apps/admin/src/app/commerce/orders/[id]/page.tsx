"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { OrderDetail, OrderStatus } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { formatMoney, useCommerceAdminApi } from "@/lib/commerce-api";

const STATUS_TONE: Record<OrderStatus, ChipTone> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
  PARTIALLY_REFUNDED: "warning",
};

function OrderDetailContent() {
  const { id } = useParams<{ id: string }>();
  const api = useCommerceAdminApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "not-found" | "error">(
    "loading",
  );
  const [order, setOrder] = React.useState<OrderDetail | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .getOrder(id)
      .then((res) => {
        setOrder(res);
        setStatus("ready");
      })
      .catch(() => setStatus("not-found"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (status === "loading") {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-32" />
        <Card>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-4 h-32 w-full" />
        </Card>
      </main>
    );
  }

  if (status === "not-found" || !order) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-heading text-2xl font-bold text-neutral-900">Order not found</h1>
        <Link
          href="/commerce/orders"
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          ← Back to orders
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/commerce/orders"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Orders
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-bold text-neutral-900">
          {order.courseTitle}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {order.userEmail} · ordered {new Date(order.createdAt).toLocaleString()}
        </p>
      </div>

      <Card>
        <div className="mb-4">
          <Chip tone={STATUS_TONE[order.status]}>{statusLabel(order.status)}</Chip>
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-neutral-500">Subtotal</dt>
            <dd className="mt-0.5 font-medium text-neutral-800">
              {formatMoney(order.subtotalAmount, order.currency)}
            </dd>
          </div>
          {order.discountAmount > 0 ? (
            <div>
              <dt className="text-neutral-500">
                Discount {order.couponCode ? `(${order.couponCode})` : ""}
              </dt>
              <dd className="mt-0.5 font-medium text-neutral-800">
                -{formatMoney(order.discountAmount, order.currency)}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-neutral-500">Total</dt>
            <dd className="mt-0.5 font-medium text-neutral-800">
              {formatMoney(order.totalAmount, order.currency)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card density="compact">
        <h2 className="font-heading text-base font-semibold text-neutral-900">Payments</h2>
        <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
          {order.payments.map((payment) => (
            <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="text-neutral-700">
                {payment.gateway} · {payment.status} · {payment.gatewayPaymentId ?? "—"}
              </span>
              <span className="shrink-0 text-neutral-500">
                {payment.verifiedAt ? new Date(payment.verifiedAt).toLocaleString() : "—"}
              </span>
            </li>
          ))}
          {order.payments.length === 0 ? (
            <li className="py-4 text-sm text-neutral-400">No payment attempts yet.</li>
          ) : null}
        </ul>
      </Card>

      {order.invoice ? (
        <Card density="compact">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-neutral-800">
              Invoice {order.invoice.invoiceNumber}
            </span>
            <span className="text-neutral-500">
              {formatMoney(order.invoice.amount, order.invoice.currency)} · issued{" "}
              {new Date(order.invoice.issuedAt).toLocaleDateString()}
            </span>
          </div>
        </Card>
      ) : null}
    </main>
  );
}

export default function OrderDetailPage() {
  return (
    <RequirePermission permission="commerce:manage">
      <OrderDetailContent />
    </RequirePermission>
  );
}
