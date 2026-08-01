import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { ReportCadence, ReportFormat, ReportType } from "@examora/types";
import type { Prisma } from "@examora/database";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CADENCE_INTERVAL_MS,
  SCHEDULED_REPORT_QUEUE,
  type ScheduledReportJobData,
} from "./scheduled-report.constants";

export interface CreateScheduledReportInput {
  name: string;
  reportType: ReportType;
  format: ReportFormat;
  cadence: ReportCadence;
  filters?: Record<string, unknown>;
}

/**
 * CRUD for the scheduled-reports foundation (ADR-0020 §5) — creating/
 * updating/deleting a ScheduledReport keeps its BullMQ repeatable job
 * scheduler (keyed by the row's own id) in sync via `upsertJobScheduler`/
 * `removeJobScheduler`, so there is never an orphaned repeatable job.
 */
@Injectable()
export class ScheduledReportsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SCHEDULED_REPORT_QUEUE) private readonly queue: Queue<ScheduledReportJobData>,
  ) {}

  private async syncScheduler(
    id: string,
    cadence: ReportCadence,
    isActive: boolean,
  ): Promise<void> {
    if (!isActive) {
      await this.queue.removeJobScheduler(id);
      return;
    }
    await this.queue.upsertJobScheduler(
      id,
      { every: CADENCE_INTERVAL_MS[cadence] },
      {
        name: "run-scheduled-report",
        data: { scheduledReportId: id },
        opts: { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
      },
    );
  }

  async create(createdById: string, input: CreateScheduledReportInput) {
    const report = await this.prisma.scheduledReport.create({
      data: {
        createdById,
        name: input.name,
        reportType: input.reportType,
        format: input.format,
        cadence: input.cadence,
        filters: input.filters as Prisma.InputJsonValue | undefined,
      },
    });
    await this.syncScheduler(report.id, report.cadence, report.isActive);
    return report;
  }

  async list(createdById?: string) {
    return this.prisma.scheduledReport.findMany({
      where: createdById ? { createdById } : {},
      orderBy: { createdAt: "desc" },
    });
  }

  async findByIdOrThrow(id: string) {
    const report = await this.prisma.scheduledReport.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException("Scheduled report not found");
    }
    return report;
  }

  async setActive(id: string, isActive: boolean) {
    const report = await this.prisma.scheduledReport.update({ where: { id }, data: { isActive } });
    await this.syncScheduler(report.id, report.cadence, report.isActive);
    return report;
  }

  async remove(id: string): Promise<void> {
    await this.queue.removeJobScheduler(id);
    await this.prisma.scheduledReport.delete({ where: { id } });
  }

  /** Fires the report's job immediately — admin convenience + testability, ADR-0020 §5. */
  async runNow(id: string): Promise<void> {
    const report = await this.findByIdOrThrow(id);
    await this.queue.add(
      "run-scheduled-report",
      { scheduledReportId: report.id },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );
  }

  async markRun(id: string): Promise<void> {
    await this.prisma.scheduledReport.update({
      where: { id },
      data: { lastRunAt: new Date() },
    });
  }
}
