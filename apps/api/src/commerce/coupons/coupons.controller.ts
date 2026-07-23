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
import type { Coupon, PaginatedData } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toCoupon } from "../commerce.mappers";
import { CouponsService } from "./coupons.service";
import { CreateCouponDto } from "./dto/create-coupon.dto";
import { UpdateCouponDto } from "./dto/update-coupon.dto";

@ApiTags("commerce: coupons (admin)")
@Controller("admin/commerce/coupons")
@RequirePermissions("commerce:manage")
export class CouponsController {
  constructor(
    private readonly couponsService: CouponsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a coupon (commerce:manage)" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateCouponDto,
    @Req() req: Request,
  ): Promise<Coupon> {
    const coupon = await this.couponsService.create(dto, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "commerce.coupon_created",
      entityType: "Coupon",
      entityId: coupon.id,
      after: { code: coupon.code },
      ...requestAuditMeta(req),
    });
    return toCoupon(coupon);
  }

  @Get()
  @ApiOperation({ summary: "List coupons" })
  async list(@Query() query: PaginationQueryDto): Promise<PaginatedData<Coupon>> {
    const { items, total } = await this.couponsService.list({
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items: items.map(toCoupon), page: query.page, pageSize: query.pageSize, total };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a coupon by id" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<Coupon> {
    return toCoupon(await this.couponsService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a coupon" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
    @Req() req: Request,
  ): Promise<Coupon> {
    const updated = await this.couponsService.update(id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "commerce.coupon_updated",
      entityType: "Coupon",
      entityId: id,
      after: { isActive: updated.isActive },
      ...requestAuditMeta(req),
    });
    return toCoupon(updated);
  }
}
