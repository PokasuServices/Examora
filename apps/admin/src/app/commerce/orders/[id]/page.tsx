"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { OrderDetail } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { formatMoney, useCommerceAdminApi } from "@/lib/commerce-api";

function OrderDetailContent() {
  const { id } = useParams<{ id: string }>();
  const api = useCommerceAdminApi();
  const [order, setOrder] = React.useState<OrderDetail | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    api
      .getOrder(id)
      .then(setOrder)
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-heading">Order not found</h1>
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
        <Link href="/commerce/orders" className="hover:underline">
          Orders
        </Link>{" "}
        · <span className="text-neutral-800">{order.courseTitle}</span>
      </nav>

      <h1 className="text-heading">{order.courseTitle}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {order.userEmail} · ordered {new Date(order.createdAt).toLocaleString()}
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
            <dt className="text-neutral-500">Total</dt>
            <dd className="font-medium">{formatMoney(order.totalAmount, order.currency)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-700">Payments</h2>
        <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {order.payments.map((payment) => (
            <li key={payment.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>
                {payment.gateway} · {payment.status} · {payment.gatewayPaymentId ?? "—"}
              </span>
              <span className="text-neutral-500">
                {payment.verifiedAt ? new Date(payment.verifiedAt).toLocaleString() : "—"}
              </span>
            </li>
          ))}
          {order.payments.length === 0 ? (
            <li className="px-4 py-3 text-sm text-neutral-400">No payment attempts yet.</li>
          ) : null}
        </ul>
      </div>

      {order.invoice ? (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 text-sm">
          <span className="font-medium">Invoice {order.invoice.invoiceNumber}</span>
          <span className="ml-2 text-neutral-500">
            {formatMoney(order.invoice.amount, order.invoice.currency)} · issued{" "}
            {new Date(order.invoice.issuedAt).toLocaleDateString()}
          </span>
        </div>
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
