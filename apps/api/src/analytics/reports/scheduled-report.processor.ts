import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { NotificationsService } from "../../notifications/notifications.service";
import { ReportBuilderService } from "./report-builder.service";
import { SCHEDULED_REPORT_QUEUE, type ScheduledReportJobData } from "./scheduled-report.constants";
import { ScheduledReportsService } from "./scheduled-reports.service";

/**
 * Fires on each cadence interval (or via "run now"): recomputes the report
 * and notifies the owner with a summary (ADR-0020 §5). Does not attach the
 * generated file — TD-042 — the owner opens the live dashboard or on-demand
 * export (ReportExportService) for the actual CSV/PDF.
 */
@Processor(SCHEDULED_REPORT_QUEUE)
export class ScheduledReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledReportProcessor.name);

  constructor(
    private readonly scheduledReportsService: ScheduledReportsService,
    private readonly reportBuilder: ReportBuilderService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<ScheduledReportJobData>): Promise<void> {
    const report = await this.scheduledReportsService.findByIdOrThrow(job.data.scheduledReportId);
    if (!report.isActive) {
      this.logger.log(`Skipping inactive scheduled report ${report.id}`);
      return;
    }

    const filters = (report.filters as Record<string, unknown> | null) ?? {};
    const result = await this.reportBuilder.build(report.reportType, filters);

    await this.notificationsService.enqueue({
      userId: report.createdById,
      eventType: "analytics.scheduled_report_ready",
      category: "analytics",
      title: `Scheduled report ready: ${report.name}`,
      body: `Your "${report.name}" report (${report.reportType.replace(/_/g, " ")}) is ready — ${result.rows.length} row(s) as of ${result.generatedAt}. Open the report builder to view or export it.`,
      data: {
        scheduledReportId: report.id,
        reportType: report.reportType,
        rowCount: result.rows.length,
      },
      channels: ["EMAIL"],
    });

    await this.scheduledReportsService.markRun(report.id);
  }
}
