"use client";

import * as React from "react";
import Link from "next/link";
import type { OrderDetail, OrderStatus } from "@examora/types";
import { CommerceNav } from "@/components/commerce-nav";
import { RequirePermission } from "@/components/require-permission";
import { formatMoney, useCommerceAdminApi } from "@/lib/commerce-api";

const STATUS_FILTERS: (OrderStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
];

function OrdersContent() {
  const api = useCommerceAdminApi();
  const [orders, setOrders] = React.useState<OrderDetail[]>([]);
  const [filter, setFilter] = React.useState<OrderStatus | "ALL">("ALL");

  React.useEffect(() => {
    api
      .listOrders(filter === "ALL" ? undefined : { status: filter })
      .then((res) => setOrders(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <CommerceNav />
      <h1 className="text-heading">Orders</h1>

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
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Course</th>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/commerce/orders/${order.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    {order.courseTitle}
                  </Link>
                </td>
                <td className="px-4 py-3">{order.userEmail}</td>
                <td className="px-4 py-3">{formatMoney(order.totalAmount, order.currency)}</td>
                <td className="px-4 py-3">{order.status.replace("_", " ")}</td>
                <td className="px-4 py-3 text-neutral-500">
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No orders.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function OrdersPage() {
  return (
    <RequirePermission permission="commerce:manage">
      <OrdersContent />
    </RequirePermission>
  );
}
