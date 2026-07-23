import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { OrderDetail, PaginatedData } from "@examora/types";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { toOrderDetail } from "../commerce.mappers";
import { ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import { OrdersService } from "./orders.service";

/** Admin order/payment monitoring across all students (ADR-0018). */
@ApiTags("commerce: orders (admin)")
@Controller("admin/commerce/orders")
@RequirePermissions("commerce:manage")
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "List all orders (commerce:manage)" })
  async list(@Query() query: ListOrdersQueryDto): Promise<PaginatedData<OrderDetail>> {
    const { items, total } = await this.ordersService.listAll({
      page: query.page,
      pageSize: query.pageSize,
      userId: query.userId,
      status: query.status,
    });
    return { items: items.map(toOrderDetail), page: query.page, pageSize: query.pageSize, total };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get any order by id" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<OrderDetail> {
    return toOrderDetail(await this.ordersService.getByIdOrThrow(id));
  }
}
