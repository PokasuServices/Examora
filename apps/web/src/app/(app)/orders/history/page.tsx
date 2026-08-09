"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { OrdersShell } from "@/components/orders/orders-shell";
import {
  useOrderHistory,
  type SortKey,
  type StatusFilter,
} from "@/components/orders/use-order-history";
import { orderStatusTone, shortOrderId, statusLabel } from "@/components/orders/format";
import { formatMoney } from "@/lib/commerce-api";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "PARTIALLY_REFUNDED", label: "Partially refunded" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "amount-desc", label: "Amount: high to low" },
  { value: "amount-asc", label: "Amount: low to high" },
];

function HistoryContent() {
  const {
    status,
    pageItems,
    filteredCount,
    totalCount,
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    sortKey,
    setSortKey,
    page,
    pageCount,
    setPage,
    retry,
  } = useOrderHistory();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by course name…"
              className="h-10 w-full rounded-md border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load your orders" onRetry={retry} />
        ) : totalCount === 0 ? (
          <EmptyState
            heading="No purchases yet"
            body="When you buy a course, it'll show up here."
            actionLabel="Browse courses"
            actionHref="/courses"
          />
        ) : filteredCount === 0 ? (
          <EmptyState
            heading="No orders match your search"
            body="Try a different search term or filter."
          />
        ) : (
          <>
            <div className="overflow-x-auto contain-layout">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Order
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Course
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Purchase date
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Amount
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Status
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <span className="sr-only">View</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {pageItems.map((order) => (
                    <tr key={order.id} className="hover:bg-neutral-50">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-neutral-500">
                        {shortOrderId(order.id)}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-neutral-800">
                        {order.courseTitle}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                        {new Date(order.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-neutral-800">
                        {formatMoney(order.totalAmount, order.currency)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Chip tone={orderStatusTone(order.status)}>
                          {statusLabel(order.status)}
                        </Chip>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={`/orders/${order.id}`}
                          className="text-sm font-medium text-primary-600 hover:underline"
                        >
                          View details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 p-4">
              <p className="text-xs text-neutral-500">
                {filteredCount} {filteredCount === 1 ? "order" : "orders"}
              </p>
              <Pagination page={page} pageCount={pageCount} onChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export default function OrderHistoryPage() {
  return (
    <RequireAuth>
      <OrdersShell>
        <HistoryContent />
      </OrdersShell>
    </RequireAuth>
  );
}
