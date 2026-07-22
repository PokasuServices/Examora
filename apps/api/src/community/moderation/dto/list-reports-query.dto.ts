import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { COMMUNITY_REPORT_STATUSES, type CommunityReportStatus } from "@examora/types";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListReportsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: COMMUNITY_REPORT_STATUSES })
  @IsOptional()
  @IsEnum(COMMUNITY_REPORT_STATUSES)
  status?: CommunityReportStatus;
}
