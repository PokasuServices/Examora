"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  CreditCard,
  GraduationCap,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { Button, FieldError, Label } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { IconBadge } from "@/components/ui/icon-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RetryInline } from "@/components/ui/retry-inline";
import { useOrderDetail } from "@/components/orders/use-order-detail";
import {
  enrollmentStatusTone,
  orderStatusTone,
  paymentStatusTone,
  refundStatusTone,
  shortOrderId,
  statusLabel,
} from "@/components/orders/format";
import { formatMoney } from "@/lib/commerce-api";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface TimelineEvent {
  label: string;
  detail?: string;
  at: string;
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return (
    <ol className="flex flex-col gap-4">
      {sorted.map((event, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-600"
              aria-hidden="true"
            />
            {i < sorted.length - 1 ? (
              <span className="mt-1 w-px flex-1 bg-neutral-200" aria-hidden="true" />
            ) : null}
          </div>
          <div className="pb-1">
            <p className="text-sm font-medium text-neutral-800">{event.label}</p>
            {event.detail ? <p className="text-xs text-neutral-500">{event.detail}</p> : null}
            <p className="text-xs text-neutral-400">{formatDateTime(event.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function RefundRequestForm({
  onSubmit,
  submitting,
  error,
}: {
  onSubmit: (reason: string) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [reason, setReason] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(reason);
      }}
      className="mt-3 flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="refund-reason">Reason for refund</Label>
        <textarea
          id="refund-reason"
          required
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        />
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" disabled={submitting || !reason.trim()} className="self-start">
        {submitting ? "Submitting…" : "Request refund"}
      </Button>
    </form>
  );
}

function OrderDetailContent({ orderId }: { orderId: string }) {
  const {
    status,
    order,
    enrollment,
    refund,
    refundRequestStatus,
    refundRequestError,
    requestRefund,
  } = useOrderDetail(orderId);

  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-40" />
        <Card>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-4 h-24 w-full" />
        </Card>
      </div>
    );
  }

  if (status === "not-found" || !order) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-heading text-2xl font-bold text-neutral-900">Order not found</h1>
        <Link
          href="/orders/history"
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          ← Back to order history
        </Link>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <RetryInline
            message="Couldn't load this order"
            onRetry={() => window.location.reload()}
          />
        </Card>
      </div>
    );
  }

  const events: TimelineEvent[] = [
    { label: "Order placed", at: order.createdAt },
    ...order.payments.map((payment) => ({
      label: `Payment ${statusLabel(payment.status).toLowerCase()}`,
      detail: `via ${payment.gateway}`,
      at: payment.verifiedAt ?? payment.createdAt,
    })),
    ...(order.invoice
      ? [
          {
            label: "Invoice issued",
            detail: order.invoice.invoiceNumber,
            at: order.invoice.issuedAt,
          },
        ]
      : []),
    ...(refund
      ? [
          { label: "Refund requested", detail: refund.reason, at: refund.requestedAt },
          ...(refund.reviewedAt
            ? [
                {
                  label: `Refund ${statusLabel(refund.status).toLowerCase()}`,
                  at: refund.reviewedAt,
                },
              ]
            : []),
        ]
      : []),
  ];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/orders/history"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Order history
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {order.courseTitle}
          </h1>
          <Chip tone={orderStatusTone(order.status)}>{statusLabel(order.status)}</Chip>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {shortOrderId(order.id)} · Ordered {formatDateTime(order.createdAt)}
        </p>
      </div>

      {/* Order summary */}
      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Order summary</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-neutral-500">Subtotal</dt>
            <dd className="mt-0.5 font-medium text-neutral-800">
              {formatMoney(order.subtotalAmount, order.currency)}
            </dd>
          </div>
          {order.discountAmount > 0 ? (
            <div>
              <dt className="text-neutral-500">
                Discount{order.couponCode ? ` (${order.couponCode})` : ""}
              </dt>
              <dd className="mt-0.5 font-medium text-neutral-800">
                -{formatMoney(order.discountAmount, order.currency)}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-neutral-500">Total paid</dt>
            <dd className="mt-0.5 font-medium text-neutral-800">
              {formatMoney(order.totalAmount, order.currency)}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Purchased items */}
      <Card>
        <div className="flex items-center gap-2">
          <IconBadge icon={BookOpen} tone="primary" />
          <h2 className="font-heading text-base font-semibold text-neutral-900">Purchased items</h2>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-md border border-neutral-100 p-3 text-sm">
          <Link
            href={`/courses/${order.courseId}`}
            className="font-medium text-primary-700 hover:underline"
          >
            {order.courseTitle}
          </Link>
          <span className="font-medium text-neutral-800">
            {formatMoney(order.totalAmount, order.currency)}
          </span>
        </div>
      </Card>

      {/* Payment information */}
      <Card>
        <div className="flex items-center gap-2">
          <IconBadge icon={CreditCard} tone="primary" />
          <h2 className="font-heading text-base font-semibold text-neutral-900">
            Payment information
          </h2>
        </div>
        {order.payments.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No payment has been recorded yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {order.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between rounded-md border border-neutral-100 p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-neutral-800">{payment.gateway}</p>
                  <p className="text-xs text-neutral-500">
                    {payment.verifiedAt ? formatDateTime(payment.verifiedAt) : "Not yet verified"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-neutral-700">
                    {formatMoney(payment.amount, payment.currency)}
                  </span>
                  <Chip tone={paymentStatusTone(payment.status)}>
                    {statusLabel(payment.status)}
                  </Chip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Invoice status */}
      <Card>
        <div className="flex items-center gap-2">
          <IconBadge icon={Receipt} tone="primary" />
          <h2 className="font-heading text-base font-semibold text-neutral-900">Invoice</h2>
        </div>
        {order.invoice ? (
          <div className="mt-4 flex items-center justify-between rounded-md border border-neutral-100 p-3 text-sm">
            <div>
              <p className="font-medium text-neutral-800">{order.invoice.invoiceNumber}</p>
              <p className="text-xs text-neutral-500">
                Issued {formatDateTime(order.invoice.issuedAt)}
              </p>
            </div>
            <span className="font-medium text-neutral-800">
              {formatMoney(order.invoice.amount, order.invoice.currency)}
            </span>
          </div>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">
            No invoice has been issued for this order yet.
          </p>
        )}
      </Card>

      {/* Enrollment status */}
      <Card>
        <div className="flex items-center gap-2">
          <IconBadge icon={GraduationCap} tone="primary" />
          <h2 className="font-heading text-base font-semibold text-neutral-900">
            Enrollment status
          </h2>
        </div>
        {enrollment ? (
          <div className="mt-4 flex items-center justify-between rounded-md border border-neutral-100 p-3 text-sm">
            <div>
              <p className="font-medium text-neutral-800">
                Enrolled {formatDateTime(enrollment.enrolledAt)}
              </p>
              {enrollment.expiresAt ? (
                <p className="text-xs text-neutral-500">
                  Expires {formatDateTime(enrollment.expiresAt)}
                </p>
              ) : null}
            </div>
            <Chip tone={enrollmentStatusTone(enrollment.status)}>
              {statusLabel(enrollment.status)}
            </Chip>
          </div>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">
            Not enrolled in this course yet — enrollment usually follows a successful payment.
          </p>
        )}
      </Card>

      {/* Refund status / request */}
      <Card>
        <div className="flex items-center gap-2">
          <IconBadge icon={RotateCcw} tone="primary" />
          <h2 className="font-heading text-base font-semibold text-neutral-900">Refund</h2>
        </div>
        {refund ? (
          <div className="mt-4 flex items-center justify-between rounded-md border border-neutral-100 p-3 text-sm">
            <div>
              <p className="font-medium text-neutral-800">{refund.reason}</p>
              <p className="text-xs text-neutral-500">
                Requested {formatDateTime(refund.requestedAt)}
              </p>
            </div>
            <Chip tone={refundStatusTone(refund.status)}>{statusLabel(refund.status)}</Chip>
          </div>
        ) : order.status === "PAID" ? (
          <RefundRequestForm
            onSubmit={(reason) => void requestRefund(reason)}
            submitting={refundRequestStatus === "submitting"}
            error={refundRequestError}
          />
        ) : (
          <p className="mt-2 text-sm text-neutral-500">
            Refunds can only be requested for paid orders.
          </p>
        )}
      </Card>

      {/* Timeline */}
      <Card>
        <div className="flex items-center gap-2">
          <IconBadge icon={Clock} tone="primary" />
          <h2 className="font-heading text-base font-semibold text-neutral-900">Timeline</h2>
        </div>
        <div className="mt-4">
          <Timeline events={events} />
        </div>
      </Card>
    </main>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <OrderDetailContent orderId={id} />
    </RequireAuth>
  );
}
