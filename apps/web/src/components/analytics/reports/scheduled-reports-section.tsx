"use client";

import * as React from "react";
import { Play, Plus, Trash2 } from "lucide-react";
import type { ReportCadence, ReportFormat, ReportType, ScheduledReportDto } from "@examora/types";
import { REPORT_CADENCES, REPORT_FORMATS, REPORT_TYPES } from "@examora/types";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField, type SelectFieldOption } from "@/components/ui/select-field";
import { Switch } from "@/components/ui/switch";
import { useReportsApi } from "@/lib/reports-api";
import { REPORT_TYPE_LABELS } from "./report-type-meta";

const REPORT_TYPE_OPTIONS: SelectFieldOption[] = REPORT_TYPES.map((t) => ({
  value: t,
  label: REPORT_TYPE_LABELS[t],
}));
const FORMAT_OPTIONS: SelectFieldOption[] = REPORT_FORMATS.map((f) => ({ value: f, label: f }));
const CADENCE_OPTIONS: SelectFieldOption[] = REPORT_CADENCES.map((c) => ({
  value: c,
  label: c.charAt(0) + c.slice(1).toLowerCase(),
}));

function CreateScheduledReportForm({ onCreated }: { onCreated: () => void }) {
  const api = useReportsApi();
  const [name, setName] = React.useState("");
  const [reportType, setReportType] = React.useState<ReportType>("STUDENT_PROGRESS");
  const [format, setFormat] = React.useState<ReportFormat>("CSV");
  const [cadence, setCadence] = React.useState<ReportCadence>("WEEKLY");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createScheduled({ name: name.trim(), reportType, format, cadence });
      setName("");
      onCreated();
    } catch {
      setError("Could not create this scheduled report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
      <div>
        <label
          htmlFor="scheduled-name"
          className="mb-1.5 block text-xs font-medium text-neutral-500"
        >
          Name
        </label>
        <input
          id="scheduled-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Weekly enrollment summary"
          className="h-10 w-full rounded-md border border-neutral-200 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <SelectField
          id="scheduled-type"
          label="Report type"
          value={reportType}
          options={REPORT_TYPE_OPTIONS}
          onChange={(v) => setReportType(v as ReportType)}
        />
        <SelectField
          id="scheduled-format"
          label="Format"
          value={format}
          options={FORMAT_OPTIONS}
          onChange={(v) => setFormat(v as ReportFormat)}
        />
        <SelectField
          id="scheduled-cadence"
          label="Cadence"
          value={cadence}
          options={CADENCE_OPTIONS}
          onChange={(v) => setCadence(v as ReportCadence)}
        />
        <div className="flex items-end">
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
          >
            <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
            {submitting ? "Creating…" : "Schedule"}
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-danger-600">{error}</p> : null}
    </form>
  );
}

export function ScheduledReportsSection() {
  const api = useReportsApi();
  const [reports, setReports] = React.useState<ScheduledReportDto[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .listScheduled()
      .then(setReports)
      .catch(() => setReports([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(id: string, isActive: boolean): Promise<void> {
    setBusyId(id);
    setActionError(null);
    try {
      await api.setScheduledActive(id, isActive);
      load();
    } catch {
      setActionError(
        "Could not update this schedule — the scheduling service didn't respond in time.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function runNow(id: string): Promise<void> {
    setBusyId(id);
    setActionError(null);
    try {
      await api.runScheduledNow(id);
      load();
    } catch {
      setActionError(
        "Could not run this report now — the scheduling service didn't respond in time.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string): Promise<void> {
    setBusyId(id);
    setActionError(null);
    try {
      await api.deleteScheduled(id);
      load();
    } catch {
      setActionError(
        "Could not delete this schedule — the scheduling service didn't respond in time.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="scheduled-reports-heading">
      <h2
        id="scheduled-reports-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Scheduled Reports
      </h2>
      <Card className="mt-3">
        <CreateScheduledReportForm onCreated={load} />
      </Card>

      {actionError ? <p className="mt-3 text-sm text-danger-600">{actionError}</p> : null}

      <Card className="mt-3" density="compact">
        {reports === null ? (
          <p className="py-4 text-center text-sm text-neutral-400">Loading…</p>
        ) : reports.length === 0 ? (
          <EmptyState
            heading="No scheduled reports yet"
            body="Create one above to run automatically."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-neutral-800">{r.name}</p>
                    <Chip tone="neutral">{REPORT_TYPE_LABELS[r.reportType]}</Chip>
                    <Chip tone="neutral">{r.format}</Chip>
                    <Chip tone="primary">
                      {r.cadence.charAt(0) + r.cadence.slice(1).toLowerCase()}
                    </Chip>
                  </div>
                  <p className="mt-1 text-xs text-neutral-400">
                    {r.lastRunAt
                      ? `Last ran ${new Date(r.lastRunAt).toLocaleString()}`
                      : "Never run"}
                    {r.nextRunAt ? ` · Next ${new Date(r.nextRunAt).toLocaleString()}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Switch
                    label={`${r.isActive ? "Disable" : "Enable"} ${r.name}`}
                    checked={r.isActive}
                    disabled={busyId === r.id}
                    onChange={(checked) => void toggleActive(r.id, checked)}
                  />
                  <button
                    type="button"
                    onClick={() => void runNow(r.id)}
                    disabled={busyId === r.id}
                    aria-label={`Run ${r.name} now`}
                    title="Run now"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-primary-600 disabled:pointer-events-none disabled:opacity-60"
                  >
                    <Play size={15} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(r.id)}
                    disabled={busyId === r.id}
                    aria-label={`Delete ${r.name}`}
                    title="Delete"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-danger-50 hover:text-danger-600 disabled:pointer-events-none disabled:opacity-60"
                  >
                    <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
