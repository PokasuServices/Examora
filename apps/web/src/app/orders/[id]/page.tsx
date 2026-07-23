"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError } from "@examora/auth-client";
import type { OrderDetail } from "@examora/types";
import { Button, FieldError, Label } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { formatMoney, useCommerceApi } from "@/lib/commerce-api";

function OrderDetailContent() {
  const { id } = useParams<{ id: string }>();
  const api = useCommerceApi();
  const [order, setOrder] = React.useState<OrderDetail | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [refundStatus, setRefundStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .getMyOrder(id)
      .then(setOrder)
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    load();
    api
      .listMyRefunds()
      .then((res) => {
        const existing = res.items.find((r) => r.orderId === id);
        if (existing) setRefundStatus(existing.status);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleRequestRefund(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const refund = await api.requestRefund(id, reason);
      setRefundStatus(refund.status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit the refund request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-heading">Order not found</h1>
        <Link href="/orders" className="mt-4 inline-block text-sm text-primary-600 hover:underline">
          Back to purchases
        </Link>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/orders" className="hover:underline">
          My purchases
        </Link>{" "}
        · <span className="text-neutral-800">{order.courseTitle}</span>
      </nav>

      <h1 className="text-heading">{order.courseTitle}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Ordered {new Date(order.createdAt).toLocaleString()}
      </p>

      <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-neutral-500">Status</dt>
            <dd className="font-medium">{order.status.replace("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Subtotal</dt>
            <dd className="font-medium">{formatMoney(order.subtotalAmount, order.currency)}</dd>
          </div>
          {order.discountAmount > 0 ? (
            <div>
              <dt className="text-neutral-500">
                Discount {order.couponCode ? `(${order.couponCode})` : ""}
              </dt>
              <dd className="font-medium">-{formatMoney(order.discountAmount, order.currency)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-neutral-500">Total paid</dt>
            <dd className="font-medium">{formatMoney(order.totalAmount, order.currency)}</dd>
          </div>
        </dl>
      </div>

      {order.payments.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-neutral-700">Payment history</h2>
          <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {order.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  {payment.gateway} · {payment.status}
                </span>
                <span className="text-neutral-500">
                  {payment.verifiedAt ? new Date(payment.verifiedAt).toLocaleString() : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {order.invoice ? (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 text-sm">
          <span className="font-medium">Invoice {order.invoice.invoiceNumber}</span>
          <span className="ml-2 text-neutral-500">
            {formatMoney(order.invoice.amount, order.invoice.currency)} · issued{" "}
            {new Date(order.invoice.issuedAt).toLocaleDateString()}
          </span>
        </div>
      ) : null}

      {order.status === "PAID" ? (
        <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-700">Refund</h2>
          {refundStatus ? (
            <p className="mt-2 text-sm text-neutral-600">
              Refund request status: <span className="font-medium">{refundStatus}</span>
            </p>
          ) : (
            <form
              onSubmit={(e) => void handleRequestRefund(e)}
              className="mt-3 flex flex-col gap-3"
            >
              <div>
                <Label htmlFor="reason">Reason for refund</Label>
                <textarea
                  id="reason"
                  required
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  rows={3}
                />
              </div>
              <FieldError>{error}</FieldError>
              <Button type="submit" disabled={submitting} className="self-start">
                {submitting ? "Submitting…" : "Request refund"}
              </Button>
            </form>
          )}
        </div>
      ) : null}
    </main>
  );
}

export default function OrderDetailPage() {
  return (
    <RequireAuth>
      <OrderDetailContent />
    </RequireAuth>
  );
}
