"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import type { OrderDetail, OrderStatus } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
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

const STATUS_TONE: Record<OrderStatus, ChipTone> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
  PARTIALLY_REFUNDED: "warning",
};

function OrdersContent() {
  const api = useCommerceAdminApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [orders, setOrders] = React.useState<OrderDetail[]>([]);
  const [filter, setFilter] = React.useState<OrderStatus | "ALL">("ALL");

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listOrders(filter === "ALL" ? undefined : { status: filter })
      .then((res) => {
        setOrders(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Orders" subtitle="All course purchase orders across the platform." />

      <Card density="compact">
        <div className="max-w-xs">
          <SelectField
            id="order-status-filter"
            label="Status"
            value={filter}
            options={STATUS_FILTERS.map((s) => ({
              value: s,
              label: s === "ALL" ? "All statuses" : statusLabel(s),
            }))}
            onChange={(v) => setFilter(v as OrderStatus | "ALL")}
          />
        </div>
      </Card>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load orders" onRetry={load} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            heading="No orders found"
            body="Try a different status filter."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Course
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Student
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Amount
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/commerce/orders/${order.id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {order.courseTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{order.userEmail}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {formatMoney(order.totalAmount, order.currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Chip tone={STATUS_TONE[order.status]}>{statusLabel(order.status)}</Chip>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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
