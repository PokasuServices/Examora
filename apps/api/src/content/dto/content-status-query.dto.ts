import { ApiPropertyOptional } from "@nestjs/swagger";
import { CONTENT_STATUSES, type ContentStatus } from "@examora/types";
import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

/** Shared list query for content collections: paginate + optional status filter. */
export class ContentListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CONTENT_STATUSES })
  @IsOptional()
  @IsIn(CONTENT_STATUSES)
  status?: ContentStatus;
}
