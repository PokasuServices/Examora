import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { InvoiceSummary, PaginatedData } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import type { RequestUser } from "../../auth/types/request-user";
import { toInvoiceSummary } from "../commerce.mappers";
import { InvoicesService } from "./invoices.service";

/** A student's own invoices (ADR-0018). */
@ApiTags("commerce: invoices")
@Controller("commerce/invoices")
@RequirePermissions("commerce:read")
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's invoices" })
  async listMine(
    @CurrentUser() actor: RequestUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedData<InvoiceSummary>> {
    const { items, total } = await this.invoicesService.listMine(actor.id, {
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      items: items.map(toInvoiceSummary),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one of the caller's invoices" })
  async getMine(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<InvoiceSummary> {
    return toInvoiceSummary(await this.invoicesService.getMineOrThrow(actor.id, id));
  }
}
