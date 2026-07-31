import type { ScheduledReportDto } from "@examora/types";

type ScheduledReportRow = {
  id: string;
  name: string;
  reportType: string;
  format: string;
  cadence: string;
  filters: unknown;
  isActive: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
};

export function toScheduledReportDto(row: ScheduledReportRow): ScheduledReportDto {
  return {
    id: row.id,
    name: row.name,
    reportType: row.reportType as ScheduledReportDto["reportType"],
    format: row.format as ScheduledReportDto["format"],
    cadence: row.cadence as ScheduledReportDto["cadence"],
    filters: (row.filters as Record<string, unknown> | null) ?? null,
    isActive: row.isActive,
    lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
    nextRunAt: row.nextRunAt ? row.nextRunAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
