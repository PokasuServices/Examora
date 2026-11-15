"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RequirePermission } from "@/components/require-permission";
import { ReportBuilderSection } from "@/components/analytics/reports/report-builder-section";
import { ScheduledReportsSection } from "@/components/analytics/reports/scheduled-reports-section";

function ReportsContent() {
  return (
    <main className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/analytics"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Admin Analytics
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-neutral-800">Reports</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Run a report on demand, export it, or schedule it to run automatically.
        </p>
      </div>

      <ReportBuilderSection />
      <ScheduledReportsSection />
    </main>
  );
}

export default function ReportsPage() {
  return (
    <RequirePermission permission="analytics:admin">
      <ReportsContent />
    </RequirePermission>
  );
}
