"use client";

import { useAuth } from "@examora/auth-client";
import type { ReportFormat, ReportResult, ReportType, ScheduledReportDto } from "@examora/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export interface ReportFilters {
  from?: string;
  to?: string;
  limit?: number;
}

function toQuery(filters: ReportFilters): string {
  const qs = new URLSearchParams();
  if (filters.from) qs.set("from", filters.from);
  if (filters.to) qs.set("to", filters.to);
  if (filters.limit) qs.set("limit", String(filters.limit));
  return qs.toString();
}

/** Typed wrappers over the Report Builder, export, and scheduled reports (analytics:admin, ADR-0020). */
export function useReportsApi() {
  const { request, accessToken } = useAuth();

  return {
    run: (reportType: ReportType, filters: ReportFilters = {}) => {
      const qs = toQuery(filters);
      return request<ReportResult>(
        `/admin/reports/run?reportType=${reportType}${qs ? `&${qs}` : ""}`,
        { method: "GET" },
      );
    },

    /**
     * The export endpoint streams a CSV/PDF file, not the JSON envelope every
     * other endpoint returns — the shared `request()` helper always parses
     * JSON, so this goes around it with a plain authenticated fetch and
     * triggers a browser download from the resulting blob.
     */
    exportAndDownload: async (
      reportType: ReportType,
      format: ReportFormat,
      filters: ReportFilters = {},
    ): Promise<void> => {
      const qs = toQuery(filters);
      const res = await fetch(
        `${API_BASE_URL}/admin/reports/export?reportType=${reportType}&format=${format}${qs ? `&${qs}` : ""}`,
        {
          method: "GET",
          credentials: "include",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        },
      );
      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`);
      }
      const disposition = res.headers.get("content-disposition");
      const filenameMatch = disposition?.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? `${reportType.toLowerCase()}.${format.toLowerCase()}`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },

    // These four mutate a BullMQ-backed job scheduler server-side
    // (ScheduledReportsService.syncScheduler) — a queue operation that can
    // legitimately hang if the broker connection is unhealthy, unlike a
    // plain DB write. A client-side timeout means the UI always resolves to
    // an error state instead of an indefinite spinner.
    createScheduled: (body: {
      name: string;
      reportType: ReportType;
      format: ReportFormat;
      cadence: "DAILY" | "WEEKLY" | "MONTHLY";
      filters?: Record<string, unknown>;
    }) =>
      request<ScheduledReportDto>("/admin/reports/scheduled", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(15_000),
      }),
    listScheduled: () =>
      request<ScheduledReportDto[]>("/admin/reports/scheduled", { method: "GET" }),
    setScheduledActive: (id: string, isActive: boolean) =>
      request<ScheduledReportDto>(`/admin/reports/scheduled/${id}/active`, {
        method: "PATCH",
        body: { isActive },
        signal: AbortSignal.timeout(15_000),
      }),
    runScheduledNow: (id: string) =>
      request<{ success: boolean }>(`/admin/reports/scheduled/${id}/run-now`, {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
      }),
    deleteScheduled: (id: string) =>
      request<void>(`/admin/reports/scheduled/${id}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(15_000),
      }),
  };
}
