import type { ReportCadence } from "@examora/types";

export const SCHEDULED_REPORT_QUEUE = "scheduled-reports";

export interface ScheduledReportJobData {
  scheduledReportId: string;
}

/** BullMQ `repeat.every` (ms) per cadence — simple fixed intervals, no cron parser dependency. */
export const CADENCE_INTERVAL_MS: Record<ReportCadence, number> = {
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
};
