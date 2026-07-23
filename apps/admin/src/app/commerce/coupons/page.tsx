"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { Coupon, CouponDiscountType } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { CommerceNav } from "@/components/commerce-nav";
import { RequirePermission } from "@/components/require-permission";
import { useCommerceAdminApi } from "@/lib/commerce-api";

function CouponsContent() {
  const api = useCommerceAdminApi();
  const [coupons, setCoupons] = React.useState<Coupon[]>([]);
  const [code, setCode] = React.useState("");
  const [discountType, setDiscountType] = React.useState<CouponDiscountType>("PERCENTAGE");
  const [discountValue, setDiscountValue] = React.useState("");
  const [maxRedemptions, setMaxRedemptions] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .listCoupons()
      .then((res) => setCoupons(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function create(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
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
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create coupon");
    }
  }

  async function toggleActive(coupon: Coupon): Promise<void> {
    try {
      await api.updateCoupon(coupon.id, { isActive: !coupon.isActive });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update coupon");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <CommerceNav />
      <h1 className="text-heading">Coupons</h1>

      <form
        onSubmit={create}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="w-40 uppercase"
            placeholder="WELCOME10"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="discountType">Type</Label>
          <select
            id="discountType"
            className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as CouponDiscountType)}
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed amount</option>
          </select>
        </div>
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
            className="w-32"
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
            className="w-32"
            placeholder="Unlimited"
          />
        </div>
        <Button type="submit">Create coupon</Button>
      </form>
      <FieldError>{error}</FieldError>

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Discount</th>
              <th className="px-4 py-3 font-medium">Redemptions</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {coupons.map((coupon) => (
              <tr key={coupon.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3 font-mono">{coupon.code}</td>
                <td className="px-4 py-3">
                  {coupon.discountType === "PERCENTAGE"
                    ? `${coupon.discountValue}%`
                    : coupon.discountValue}
                </td>
                <td className="px-4 py-3">
                  {coupon.redemptionCount}
                  {coupon.maxRedemptions !== null ? ` / ${coupon.maxRedemptions}` : ""}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      coupon.isActive
                        ? "bg-success-50 text-success-700"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {coupon.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" onClick={() => void toggleActive(coupon)}>
                    {coupon.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No coupons yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
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
