import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { CheckoutSession, OrderDetail, OrderSummary, PaginatedData } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toOrderDetail, toOrderSummary } from "../commerce.mappers";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrdersService } from "./orders.service";

/** Checkout + a student's own order history (ADR-0018) — gated by the baseline `commerce:read`. */
@ApiTags("commerce: orders")
@Controller("commerce/orders")
@RequirePermissions("commerce:read")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Start checkout for a paid course" })
  async checkout(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateOrderDto,
    @Req() req: Request,
  ): Promise<CheckoutSession> {
    const result = await this.ordersService.checkout(actor.id, dto.courseId, dto.couponCode);
    await this.auditService.record({
      actorId: actor.id,
      action: "commerce.order_created",
      entityType: "Order",
      entityId: result.order.id,
      after: { courseId: dto.courseId, totalAmount: result.amount },
      ...requestAuditMeta(req),
    });
    return {
      order: toOrderSummary(result.order),
      gateway: "RAZORPAY",
      gatewayOrderId: result.gatewayOrderId,
      gatewayKeyId: result.gatewayKeyId,
      amount: result.amount,
      currency: result.currency,
    };
  }

  @Get()
  @ApiOperation({ summary: "List the caller's orders" })
  async listMine(
    @CurrentUser() actor: RequestUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedData<OrderSummary>> {
    const { items, total } = await this.ordersService.listMine(actor.id, {
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items: items.map(toOrderSummary), page: query.page, pageSize: query.pageSize, total };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one of the caller's orders" })
  async getMine(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<OrderDetail> {
    return toOrderDetail(await this.ordersService.getMineOrThrow(actor.id, id));
  }
}
