"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import {
  REPORT_CADENCES,
  REPORT_FORMATS,
  REPORT_TYPES,
  type ReportCadence,
  type ReportFormat,
  type ReportResult,
  type ReportType,
  type ScheduledReportDto,
} from "@examora/types";
import { Button, Input, Label } from "@examora/ui";
import { AnalyticsNav } from "@/components/analytics-nav";
import { RequirePermission } from "@/components/require-permission";
import { useReportsApi } from "@/lib/analytics-api";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ReportBuilder() {
  const api = useReportsApi();
  const [reportType, setReportType] = React.useState<ReportType>(REPORT_TYPES[0]);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [result, setResult] = React.useState<ReportResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const report = await api.run(reportType, { from: from || undefined, to: to || undefined });
      setResult(report);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not run report");
    } finally {
      setLoading(false);
    }
  }

  async function exportAs(format: ReportFormat): Promise<void> {
    setError(null);
    try {
      await api.download(reportType, format, { from: from || undefined, to: to || undefined });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not export report");
    }
  }

  return (
    <Section title="Report builder">
      <form
        onSubmit={run}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reportType">Report type</Label>
          <select
            id="reportType"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="h-10 w-64 rounded-md border border-neutral-300 bg-white px-3 text-sm"
          >
            {REPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Running…" : "Run report"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => void exportAs("CSV")}>
          Export CSV
        </Button>
        <Button type="button" variant="secondary" onClick={() => void exportAs("PDF")}>
          Export PDF
        </Button>
      </form>

      {error ? <p className="mt-2 text-sm text-error-600">{error}</p> : null}

      {result ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                {result.columns.map((col) => (
                  <th key={col} className="px-4 py-3 font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr key={index} className="border-b border-neutral-100 last:border-0">
                  {result.columns.map((col) => (
                    <td key={col} className="px-4 py-3 text-neutral-600">
                      {row[col] === null ? "—" : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
              {result.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={result.columns.length}
                    className="px-4 py-6 text-center text-neutral-500"
                  >
                    No rows for this report.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </Section>
  );
}

function ScheduledReports() {
  const api = useReportsApi();
  const [items, setItems] = React.useState<ScheduledReportDto[]>([]);
  const [name, setName] = React.useState("");
  const [reportType, setReportType] = React.useState<ReportType>(REPORT_TYPES[0]);
  const [format, setFormat] = React.useState<ReportFormat>(REPORT_FORMATS[0]);
  const [cadence, setCadence] = React.useState<ReportCadence>(REPORT_CADENCES[0]);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .listScheduled()
      .then(setItems)
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
      await api.createScheduled({ name, reportType, format, cadence });
      setName("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create scheduled report");
    }
  }

  async function toggleActive(report: ScheduledReportDto): Promise<void> {
    try {
      await api.setScheduledActive(report.id, !report.isActive);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update scheduled report");
    }
  }

  async function runNow(id: string): Promise<void> {
    try {
      await api.runScheduledNow(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not run scheduled report");
    }
  }

  async function remove(id: string): Promise<void> {
    try {
      await api.deleteScheduled(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete scheduled report");
    }
  }

  return (
    <Section title="Scheduled reports">
      <form
        onSubmit={create}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scheduledType">Report type</Label>
          <select
            id="scheduledType"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="h-10 w-56 rounded-md border border-neutral-300 bg-white px-3 text-sm"
          >
            {REPORT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="format">Format</Label>
          <select
            id="format"
            value={format}
            onChange={(e) => setFormat(e.target.value as ReportFormat)}
            className="h-10 w-28 rounded-md border border-neutral-300 bg-white px-3 text-sm"
          >
            {REPORT_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cadence">Cadence</Label>
          <select
            id="cadence"
            value={cadence}
            onChange={(e) => setCadence(e.target.value as ReportCadence)}
            className="h-10 w-32 rounded-md border border-neutral-300 bg-white px-3 text-sm"
          >
            {REPORT_CADENCES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Create</Button>
      </form>

      {error ? <p className="mt-2 text-sm text-error-600">{error}</p> : null}

      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Format</th>
              <th className="px-4 py-3 font-medium">Cadence</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last run</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((report) => (
              <tr key={report.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3 text-neutral-800">{report.name}</td>
                <td className="px-4 py-3 text-neutral-600">{report.reportType}</td>
                <td className="px-4 py-3 text-neutral-600">{report.format}</td>
                <td className="px-4 py-3 text-neutral-600">{report.cadence}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      report.isActive
                        ? "bg-success-50 text-success-700"
                        : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {report.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {report.lastRunAt ? new Date(report.lastRunAt).toLocaleString() : "Never"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleActive(report)}
                      className="text-primary-600 hover:underline"
                    >
                      {report.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void runNow(report.id)}
                      className="text-primary-600 hover:underline"
                    >
                      Run now
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(report.id)}
                      className="text-error-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">
                  No scheduled reports yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function ReportsContent() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <AnalyticsNav />
      <h1 className="text-heading">Reports</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Run and export ad-hoc reports, or schedule recurring ones (ADR-0020).
      </p>

      <ReportBuilder />
      <ScheduledReports />
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
