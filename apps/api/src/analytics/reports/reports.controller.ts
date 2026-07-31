import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import type { ScheduledReportDto } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toScheduledReportDto } from "../analytics.mappers";
import { CreateScheduledReportDto } from "../dto/create-scheduled-report.dto";
import { ExportReportQueryDto } from "../dto/export-report-query.dto";
import { RunReportQueryDto } from "../dto/run-report-query.dto";
import { SetScheduledReportActiveDto } from "../dto/set-scheduled-report-active.dto";
import { ReportBuilderService } from "./report-builder.service";
import { ReportExportService } from "./report-export.service";
import { ScheduledReportsService } from "./scheduled-reports.service";

const CONTENT_TYPE: Record<"CSV" | "PDF", string> = {
  CSV: "text/csv; charset=utf-8",
  PDF: "application/pdf",
};

/** Report Builder, on-demand export, and scheduled reports (analytics:admin, ADR-0020). */
@ApiTags("analytics (admin)")
@Controller("admin/reports")
@RequirePermissions("analytics:admin")
export class ReportsController {
  constructor(
    private readonly reportBuilder: ReportBuilderService,
    private readonly reportExport: ReportExportService,
    private readonly scheduledReportsService: ScheduledReportsService,
    private readonly auditService: AuditService,
  ) {}

  @Get("run")
  @ApiOperation({ summary: "Run a report and return its tabular result" })
  async run(@Query() query: RunReportQueryDto) {
    return this.reportBuilder.build(query.reportType, {
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
  }

  @Get("export")
  @ApiOperation({ summary: "Run a report and download it as CSV or PDF" })
  async export(@Query() query: ExportReportQueryDto, @Res() res: Response): Promise<void> {
    const report = await this.reportBuilder.build(query.reportType, {
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
    const filename = `${report.reportType.toLowerCase()}-${report.generatedAt.slice(0, 10)}.${query.format.toLowerCase()}`;

    res.setHeader("Content-Type", CONTENT_TYPE[query.format]);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    if (query.format === "CSV") {
      res.send(this.reportExport.toCsv(report));
      return;
    }
    const pdf = await this.reportExport.toPdf(report);
    res.send(pdf);
  }

  @Post("scheduled")
  @ApiOperation({ summary: "Create a scheduled report" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateScheduledReportDto,
    @Req() req: Request,
  ): Promise<ScheduledReportDto> {
    const report = await this.scheduledReportsService.create(actor.id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "analytics.scheduled_report_created",
      entityType: "ScheduledReport",
      entityId: report.id,
      after: { name: report.name, reportType: report.reportType, cadence: report.cadence },
      ...requestAuditMeta(req),
    });
    return toScheduledReportDto(report);
  }

  @Get("scheduled")
  @ApiOperation({ summary: "List scheduled reports" })
  async list(): Promise<ScheduledReportDto[]> {
    const reports = await this.scheduledReportsService.list();
    return reports.map(toScheduledReportDto);
  }

  @Patch("scheduled/:id/active")
  @ApiOperation({ summary: "Enable or disable a scheduled report" })
  async setActive(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SetScheduledReportActiveDto,
    @Req() req: Request,
  ): Promise<ScheduledReportDto> {
    const report = await this.scheduledReportsService.setActive(id, dto.isActive);
    await this.auditService.record({
      actorId: actor.id,
      action: dto.isActive
        ? "analytics.scheduled_report_activated"
        : "analytics.scheduled_report_deactivated",
      entityType: "ScheduledReport",
      entityId: id,
      ...requestAuditMeta(req),
    });
    return toScheduledReportDto(report);
  }

  @Post("scheduled/:id/run-now")
  @ApiOperation({ summary: "Fire a scheduled report's job immediately" })
  async runNow(@Param("id", ParseUUIDPipe) id: string): Promise<{ success: boolean }> {
    await this.scheduledReportsService.runNow(id);
    return { success: true };
  }

  @Delete("scheduled/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a scheduled report" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.scheduledReportsService.remove(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "analytics.scheduled_report_deleted",
      entityType: "ScheduledReport",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
