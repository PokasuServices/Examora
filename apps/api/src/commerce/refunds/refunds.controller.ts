import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { PaginatedData, RefundSummary } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toRefundSummary } from "../commerce.mappers";
import { RequestRefundDto } from "./dto/request-refund.dto";
import { RefundsService } from "./refunds.service";

/** A student requesting a refund on their own order (ADR-0018). */
@ApiTags("commerce: refunds")
@Controller("commerce/refunds")
@RequirePermissions("commerce:read")
export class RefundsController {
  constructor(
    private readonly refundsService: RefundsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Request a refund on one of the caller's paid orders" })
  async request(
    @CurrentUser() actor: RequestUser,
    @Body() dto: RequestRefundDto,
    @Req() req: Request,
  ): Promise<RefundSummary> {
    const refund = await this.refundsService.request(actor.id, dto.orderId, dto.reason);
    await this.auditService.record({
      actorId: actor.id,
      action: "commerce.refund_requested",
      entityType: "Refund",
      entityId: refund.id,
      after: { orderId: dto.orderId },
      ...requestAuditMeta(req),
    });
    return toRefundSummary(refund);
  }

  @Get()
  @ApiOperation({ summary: "List the caller's refund requests" })
  async listMine(
    @CurrentUser() actor: RequestUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedData<RefundSummary>> {
    const { items, total } = await this.refundsService.listMine(actor.id, {
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items: items.map(toRefundSummary), page: query.page, pageSize: query.pageSize, total };
  }
}
