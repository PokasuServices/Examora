import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { PaginatedData, PaymentSummary } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import type { RequestUser } from "../../auth/types/request-user";
import { toPaymentSummary } from "../commerce.mappers";
import { PaymentsService } from "./payments.service";

/** A student's own payment/transaction history (ADR-0018). */
@ApiTags("commerce: payments")
@Controller("commerce/payments")
@RequirePermissions("commerce:read")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's payment history" })
  async listMine(
    @CurrentUser() actor: RequestUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedData<PaymentSummary>> {
    const { items, total } = await this.paymentsService.listMine(actor.id, {
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      items: items.map(toPaymentSummary),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }
}
