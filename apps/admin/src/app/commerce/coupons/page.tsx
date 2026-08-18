"use client";

import * as React from "react";
import { Tag } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { Coupon, CouponDiscountType } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommerceAdminApi } from "@/lib/commerce-api";

function CouponsContent() {
  const api = useCommerceAdminApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [coupons, setCoupons] = React.useState<Coupon[]>([]);
  const [formOpen, setFormOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [discountType, setDiscountType] = React.useState<CouponDiscountType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = React.useState("");
  const [maxRedemptions, setMaxRedemptions] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listCoupons()
      .then((res) => {
        setCoupons(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function create(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.createCoupon({
        code: code.toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
      });
      setCode("");
      setDiscountValue("");
      setMaxRedemptions("");
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create coupon");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(coupon: Coupon): Promise<void> {
    setError(null);
    try {
      await api.updateCoupon(coupon.id, { isActive: !coupon.isActive });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update coupon");
    }
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Coupons"
        subtitle="Discount codes redeemable at checkout."
        actions={
          !formOpen ? <Button onClick={() => setFormOpen(true)}>New coupon</Button> : undefined
        }
      />

      {formOpen ? (
        <form
          onSubmit={(e) => void create(e)}
          className="flex flex-col gap-4 rounded-md border border-neutral-100 bg-neutral-50/50 p-4"
        >
          <h3 className="font-heading text-sm font-semibold text-neutral-900">New coupon</h3>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="uppercase"
                placeholder="WELCOME10"
              />
            </div>
            <SelectField
              id="discountType"
              label="Type"
              value={discountType}
              options={[
                { value: "PERCENTAGE", label: "Percentage" },
                { value: "FIXED", label: "Fixed amount" },
              ]}
              onChange={(v) => setDiscountType(v as CouponDiscountType)}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="discountValue">
                {discountType === "PERCENTAGE" ? "Percent off" : "Amount off"}
              </Label>
              <Input
                id="discountValue"
                type="number"
                min="0"
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxRedemptions">Max redemptions</Label>
              <Input
                id="maxRedemptions"
                type="number"
                min="1"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="Unlimited"
              />
            </div>
          </div>
          <FieldError>{error}</FieldError>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting || !code.trim() || !discountValue}>
              {submitting ? "Creating…" : "Create coupon"}
            </Button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-sm font-medium text-neutral-600 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load coupons" onRetry={load} />
        ) : coupons.length === 0 ? (
          <EmptyState
            icon={Tag}
            heading="No coupons yet"
            body="Create the first one to get started."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Code
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Discount
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Redemptions
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700">{coupon.code}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {coupon.discountType === "PERCENTAGE"
                        ? `${coupon.discountValue}%`
                        : coupon.discountValue}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {coupon.redemptionCount}
                      {coupon.maxRedemptions !== null ? ` / ${coupon.maxRedemptions}` : ""}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Chip tone={coupon.isActive ? "success" : "neutral"}>
                        {coupon.isActive ? "Active" : "Inactive"}
                      </Chip>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void toggleActive(coupon)}
                        className="text-sm font-medium text-primary-600 hover:underline"
                      >
                        {coupon.isActive ? "Deactivate" : "Activate"}
                      </button>
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

export default function CouponsPage() {
  return (
    <RequirePermission permission="commerce:manage">
      <CouponsContent />
    </RequirePermission>
  );
}
