"use client";

import * as React from "react";
import { Download, Play } from "lucide-react";
import type { ReportFormat, ReportResult, ReportType } from "@examora/types";
import { REPORT_TYPES } from "@examora/types";
import { Card } from "@/components/ui/card";
import { SelectField, type SelectFieldOption } from "@/components/ui/select-field";
import { ReportTable } from "@/components/analytics/report-table";
import { useReportsApi } from "@/lib/reports-api";
import { DATE_FILTERED_REPORT_TYPES, REPORT_TYPE_LABELS } from "./report-type-meta";

const REPORT_TYPE_OPTIONS: SelectFieldOption[] = REPORT_TYPES.map((t) => ({
  value: t,
  label: REPORT_TYPE_LABELS[t],
}));

export function ReportBuilderSection() {
  const api = useReportsApi();
  const [reportType, setReportType] = React.useState<ReportType>("STUDENT_PROGRESS");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [result, setResult] = React.useState<ReportResult | null>(null);
  const [running, setRunning] = React.useState(false);
  const [exporting, setExporting] = React.useState<ReportFormat | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const isDateFiltered = DATE_FILTERED_REPORT_TYPES.includes(reportType);

  async function handleRun(): Promise<void> {
    setRunning(true);
    setError(null);
    try {
      const res = await api.run(reportType, {
        from: isDateFiltered && from ? from : undefined,
        to: isDateFiltered && to ? to : undefined,
      });
      setResult(res);
    } catch {
      setError("Could not run this report.");
    } finally {
      setRunning(false);
    }
  }

  async function handleExport(format: ReportFormat): Promise<void> {
    setExporting(format);
    setError(null);
    try {
      await api.exportAndDownload(reportType, format, {
        from: isDateFiltered && from ? from : undefined,
        to: isDateFiltered && to ? to : undefined,
      });
    } catch {
      setError(`Could not export as ${format}.`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <section aria-labelledby="report-builder-heading">
      <h2
        id="report-builder-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Report Builder
      </h2>
      <Card className="mt-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <SelectField
            id="report-type"
            label="Report type"
            value={reportType}
            options={REPORT_TYPE_OPTIONS}
            onChange={(v) => setReportType(v as ReportType)}
          />
          <div>
            <label
              htmlFor="report-from"
              className="mb-1.5 block text-xs font-medium text-neutral-500"
            >
              From
            </label>
            <input
              id="report-from"
              type="date"
              disabled={!isDateFiltered}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:bg-neutral-50 disabled:text-neutral-400"
            />
          </div>
          <div>
            <label
              htmlFor="report-to"
              className="mb-1.5 block text-xs font-medium text-neutral-500"
            >
              To
            </label>
            <input
              id="report-to"
              type="date"
              disabled={!isDateFiltered}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:bg-neutral-50 disabled:text-neutral-400"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void handleRun()}
              disabled={running}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
            >
              <Play size={15} strokeWidth={1.75} aria-hidden="true" />
              {running ? "Running…" : "Run report"}
            </button>
          </div>
        </div>
        {!isDateFiltered ? (
          <p className="mt-2 text-xs text-neutral-400">
            {REPORT_TYPE_LABELS[reportType]} doesn&rsquo;t use a date range — it always reflects
            current totals.
          </p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-danger-600">{error}</p> : null}

        {result ? (
          <div className="mt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-neutral-500">
                {result.rows.length} row{result.rows.length === 1 ? "" : "s"} · generated{" "}
                {new Date(result.generatedAt).toLocaleString()}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleExport("CSV")}
                  disabled={exporting !== null}
                  className="flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-60"
                >
                  <Download size={13} strokeWidth={1.75} aria-hidden="true" />
                  {exporting === "CSV" ? "Exporting…" : "Export CSV"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleExport("PDF")}
                  disabled={exporting !== null}
                  className="flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-60"
                >
                  <Download size={13} strokeWidth={1.75} aria-hidden="true" />
                  {exporting === "PDF" ? "Exporting…" : "Export PDF"}
                </button>
              </div>
            </div>
            <ReportTable result={result} />
          </div>
        ) : null}
      </Card>
    </section>
  );
}
