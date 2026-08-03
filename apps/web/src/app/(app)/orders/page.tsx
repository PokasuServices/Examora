"use client";

import * as React from "react";
import Link from "next/link";
import type { OrderSummary } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { formatMoney, useCommerceApi } from "@/lib/commerce-api";

const STATUS_STYLES: Record<OrderSummary["status"], string> = {
  PENDING: "bg-neutral-100 text-neutral-600",
  PAID: "bg-success-50 text-success-700",
  FAILED: "bg-error-50 text-error-700",
  CANCELLED: "bg-neutral-100 text-neutral-600",
  REFUNDED: "bg-neutral-100 text-neutral-600",
  PARTIALLY_REFUNDED: "bg-neutral-100 text-neutral-600",
};

function OrdersContent() {
  const api = useCommerceApi();
  const [orders, setOrders] = React.useState<OrderSummary[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api
      .listMyOrders()
      .then((res) => setOrders(res.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">My purchases</h1>
        <Link href="/courses" className="text-sm text-primary-600 hover:underline">
          Explore courses →
        </Link>
      </div>

      {loading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}
      {!loading && orders.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          No purchases yet.{" "}
          <Link href="/courses" className="text-primary-600 hover:underline">
            Browse paid courses
          </Link>
          .
        </p>
      ) : null}

      {orders.length > 0 ? (
        <ul className="mt-6 flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex items-center justify-between px-4 py-4 text-sm hover:bg-neutral-50"
              >
                <div>
                  <p className="font-medium text-neutral-900">{order.courseTitle}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                    {order.couponCode ? ` · coupon ${order.couponCode}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {formatMoney(order.totalAmount, order.currency)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[order.status]}`}
                  >
                    {order.status.replace("_", " ")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersContent />
    </RequireAuth>
  );
}
