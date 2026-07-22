import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { CommunityReport, PaginatedData } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toCommunityReport } from "../community.mappers";
import { CommunityReportsService } from "./community-reports.service";
import { CreateReportDto } from "./dto/create-report.dto";
import { ListReportsQueryDto } from "./dto/list-reports-query.dto";
import { ReviewReportDto } from "./dto/review-report.dto";

/**
 * Reporting (any authenticated user, `community:read`) and the moderation
 * queue (`community:moderate` only) — ADR-0017.
 */
@ApiTags("community: moderation")
@Controller("community")
@RequirePermissions("community:read")
export class CommunityReportsController {
  constructor(
    private readonly reportsService: CommunityReportsService,
    private readonly auditService: AuditService,
  ) {}

  @Post("reports")
  @ApiOperation({ summary: "Report a thread or reply" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateReportDto,
    @Req() req: Request,
  ): Promise<CommunityReport> {
    const report = await this.reportsService.create(
      actor,
      dto.targetType,
      dto.targetId,
      dto.reason,
    );
    await this.auditService.record({
      actorId: actor.id,
      action: "community.content_reported",
      entityType: "CommunityReport",
      entityId: report.id,
      after: { targetType: dto.targetType, targetId: dto.targetId },
      ...requestAuditMeta(req),
    });
    return toCommunityReport({ ...report, targetPreview: null });
  }

  @Get("moderation/reports")
  @RequirePermissions("community:moderate")
  @ApiOperation({ summary: "List the report queue (community:moderate)" })
  async listQueue(@Query() query: ListReportsQueryDto): Promise<PaginatedData<CommunityReport>> {
    const { items, total } = await this.reportsService.listQueue({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });
    return {
      items: items.map(toCommunityReport),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  @Patch("moderation/reports/:id")
  @RequirePermissions("community:moderate")
  @ApiOperation({ summary: "Mark a report reviewed or dismissed (community:moderate)" })
  async review(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewReportDto,
    @Req() req: Request,
  ): Promise<CommunityReport> {
    const report = await this.reportsService.review(actor, id, dto.status);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.report_reviewed",
      entityType: "CommunityReport",
      entityId: id,
      after: { status: dto.status },
      ...requestAuditMeta(req),
    });
    return toCommunityReport({ ...report, targetPreview: null });
  }
}
