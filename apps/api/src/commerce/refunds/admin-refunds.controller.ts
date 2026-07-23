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
import type { PaginatedData, RefundSummary } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toRefundSummary } from "../commerce.mappers";
import { ListRefundsQueryDto } from "./dto/list-refunds-query.dto";
import { ReviewRefundDto } from "./dto/review-refund.dto";
import { RefundsService } from "./refunds.service";

/** Admin refund review + processing (ADR-0018, foundation only — see TD-037). */
@ApiTags("commerce: refunds (admin)")
@Controller("admin/commerce/refunds")
@RequirePermissions("commerce:manage")
export class AdminRefundsController {
  constructor(
    private readonly refundsService: RefundsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List all refund requests (commerce:manage)" })
  async list(@Query() query: ListRefundsQueryDto): Promise<PaginatedData<RefundSummary>> {
    const { items, total } = await this.refundsService.listAll({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });
    return { items: items.map(toRefundSummary), page: query.page, pageSize: query.pageSize, total };
  }

  @Patch(":id/review")
  @ApiOperation({ summary: "Approve or deny a refund request" })
  async review(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewRefundDto,
    @Req() req: Request,
  ): Promise<RefundSummary> {
    const refund = await this.refundsService.review(actor.id, id, dto.status);
    await this.auditService.record({
      actorId: actor.id,
      action: "commerce.refund_reviewed",
      entityType: "Refund",
      entityId: id,
      after: { status: dto.status },
      ...requestAuditMeta(req),
    });
    return toRefundSummary(refund);
  }

  @Post(":id/process")
  @ApiOperation({ summary: "Mark an approved refund as processed" })
  async process(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<RefundSummary> {
    const refund = await this.refundsService.process(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "commerce.refund_processed",
      entityType: "Refund",
      entityId: id,
      ...requestAuditMeta(req),
    });
    return toRefundSummary(refund);
  }
}
