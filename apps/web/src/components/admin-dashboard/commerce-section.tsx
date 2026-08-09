import { RotateCcw, ShoppingBag, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import {
  orderStatusTone,
  refundStatusTone,
  shortOrderId,
  statusLabel,
} from "@/components/orders/format";
import { formatMoney } from "@/lib/commerce-api";
import { ADMIN_LINKS } from "./admin-links";
import type { AdminCoursePerformanceEntry, OrderDetail, RefundSummary } from "@examora/types";

export function CommerceSection({
  recentOrders,
  refundQueue,
  coursePerformance,
  revenueCurrency,
}: {
  recentOrders: OrderDetail[];
  refundQueue: RefundSummary[];
  coursePerformance: AdminCoursePerformanceEntry[];
  revenueCurrency: string;
}) {
  const topCourses = [...coursePerformance].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return (
    <section aria-labelledby="commerce-heading">
      <h2 id="commerce-heading" className="font-heading text-lg font-semibold text-neutral-900">
        Commerce overview
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShoppingBag
                size={16}
                strokeWidth={1.75}
                className="text-primary-600"
                aria-hidden="true"
              />
              <h3 className="font-heading text-sm font-semibold text-neutral-900">Recent orders</h3>
            </div>
            <a
              href={ADMIN_LINKS.commerce}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              View all →
            </a>
          </div>
          {recentOrders.length === 0 ? (
            <EmptyState heading="No orders yet" />
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
              {recentOrders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-800">{order.courseTitle}</p>
                    <p className="text-xs text-neutral-500">
                      {shortOrderId(order.id)} · {order.userEmail}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-medium text-neutral-700">
                      {formatMoney(order.totalAmount, order.currency)}
                    </span>
                    <Chip tone={orderStatusTone(order.status)}>{statusLabel(order.status)}</Chip>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RotateCcw
                size={16}
                strokeWidth={1.75}
                className="text-warning-600"
                aria-hidden="true"
              />
              <h3 className="font-heading text-sm font-semibold text-neutral-900">Refund queue</h3>
            </div>
            <a
              href={ADMIN_LINKS.refunds}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              Review →
            </a>
          </div>
          {refundQueue.length === 0 ? (
            <EmptyState heading="Nothing pending" body="No refund requests awaiting review." />
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
              {refundQueue.map((refund) => (
                <li key={refund.id} className="py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium text-neutral-800">
                      {refund.requestedByEmail}
                    </p>
                    <Chip tone={refundStatusTone(refund.status)}>{statusLabel(refund.status)}</Chip>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">{refund.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Trophy size={16} strokeWidth={1.75} className="text-accent-600" aria-hidden="true" />
            <h3 className="font-heading text-sm font-semibold text-neutral-900">Top courses</h3>
          </div>
          {topCourses.length === 0 ? (
            <EmptyState heading="No revenue yet" />
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
              {topCourses.map((course) => (
                <li
                  key={course.courseId}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate text-neutral-800">{course.courseTitle}</span>
                  <span className="shrink-0 font-medium text-neutral-700">
                    {formatMoney(course.revenue, revenueCurrency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}
