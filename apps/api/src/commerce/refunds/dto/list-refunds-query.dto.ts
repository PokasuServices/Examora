import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { REFUND_STATUSES, type RefundStatus } from "@examora/types";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListRefundsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: REFUND_STATUSES })
  @IsOptional()
  @IsEnum(REFUND_STATUSES)
  status?: RefundStatus;
}
