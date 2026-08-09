"use client";

import Link from "next/link";
import { Clock, GraduationCap, ShoppingBag, SquareCheckBig } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { StatCard, StatCardSkeletonTile } from "@/components/dashboard/stat-card";
import { OrdersShell } from "@/components/orders/orders-shell";
import { useOrdersDashboard } from "@/components/orders/use-orders-dashboard";
import { orderStatusTone, shortOrderId, statusLabel } from "@/components/orders/format";
import { formatMoney } from "@/lib/commerce-api";

function DashboardContent() {
  const {
    status,
    totalPurchases,
    activeCourses,
    completedPurchases,
    pendingOrders,
    recentOrders,
    hasAnyOrders,
    retry,
  } = useOrdersDashboard();

  if (status === "error") {
    return (
      <Card>
        <RetryInline message="Couldn't load your orders" onRetry={retry} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {status === "loading" ? (
          <>
            <StatCardSkeletonTile />
            <StatCardSkeletonTile />
            <StatCardSkeletonTile />
            <StatCardSkeletonTile />
          </>
        ) : (
          <>
            <StatCard
              icon={ShoppingBag}
              tone="primary"
              label="Total purchases"
              value={String(totalPurchases)}
              accessibleLabel="Total purchases"
            />
            <StatCard
              icon={GraduationCap}
              tone="success"
              label="Active courses"
              value={String(activeCourses)}
              accessibleLabel="Active courses"
            />
            <StatCard
              icon={SquareCheckBig}
              tone="accent"
              label="Completed purchases"
              value={String(completedPurchases)}
              accessibleLabel="Completed purchases"
            />
            <StatCard
              icon={Clock}
              tone="warning"
              label="Pending orders"
              value={String(pendingOrders)}
              accessibleLabel="Pending orders"
            />
          </>
        )}
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-neutral-900">Recent orders</h2>
          {hasAnyOrders ? (
            <Link
              href="/orders/history"
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              View all →
            </Link>
          ) : null}
        </div>

        {status === "loading" ? (
          <div className="mt-4 flex flex-col gap-2">
            <div className="h-14 animate-pulse rounded-md bg-neutral-100" />
            <div className="h-14 animate-pulse rounded-md bg-neutral-100" />
            <div className="h-14 animate-pulse rounded-md bg-neutral-100" />
          </div>
        ) : !hasAnyOrders ? (
          <EmptyState
            icon={ShoppingBag}
            heading="No purchases yet"
            body="When you buy a course, it'll show up here."
            actionLabel="Browse courses"
            actionHref="/courses"
          />
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-neutral-100">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between gap-4 py-3 hover:bg-neutral-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-800">
                      {order.courseTitle}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {shortOrderId(order.id)} ·{" "}
                      {new Date(order.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium text-neutral-800">
                      {formatMoney(order.totalAmount, order.currency)}
                    </span>
                    <Chip tone={orderStatusTone(order.status)}>{statusLabel(order.status)}</Chip>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function OrdersDashboardPage() {
  return (
    <RequireAuth>
      <OrdersShell>
        <DashboardContent />
      </OrdersShell>
    </RequireAuth>
  );
}
