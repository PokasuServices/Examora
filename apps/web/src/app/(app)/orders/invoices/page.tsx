"use client";

import { Receipt } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { OrdersShell } from "@/components/orders/orders-shell";
import { useInvoices } from "@/components/orders/use-invoices";
import { formatMoney } from "@/lib/commerce-api";

function InvoicesContent() {
  const { status, invoices, retry } = useInvoices();

  return (
    <Card density="compact" className="min-w-0">
      <div className="flex items-center gap-2 p-4 pb-0">
        <h2 className="text-lg font-medium text-neutral-800 dark:text-white/90">Invoices</h2>
      </div>
      {status === "loading" ? (
        <div className="flex flex-col gap-2 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : status === "error" ? (
        <RetryInline message="Couldn't load your invoices" onRetry={retry} />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          heading="No invoices yet"
          body="An invoice is issued once a purchase is completed."
        />
      ) : (
        <div className="overflow-x-auto contain-layout p-4 pt-3">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-neutral-50 dark:bg-white/[0.03]">
              <tr>
                <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Invoice number
                </th>
                <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Date
                </th>
                <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Amount
                </th>
                <th className="whitespace-nowrap border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-neutral-50 dark:hover:bg-white/[0.03]">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-neutral-800 dark:text-white/90">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {new Date(invoice.issuedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-800 dark:text-white/90">
                    {formatMoney(invoice.amount, invoice.currency)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Chip tone="success">Issued</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 px-1 text-xs text-neutral-400 dark:text-neutral-500">
            Downloadable PDF invoices aren&rsquo;t available yet — this is the invoice information
            Examora currently records.
          </p>
        </div>
      )}
    </Card>
  );
}

export default function InvoicesPage() {
  return (
    <RequireAuth>
      <OrdersShell>
        <InvoicesContent />
      </OrdersShell>
    </RequireAuth>
  );
}
