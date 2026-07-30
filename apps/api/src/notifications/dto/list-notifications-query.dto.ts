import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBooleanString, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Only unread notifications when true" })
  @IsOptional()
  @IsBooleanString()
  unreadOnly?: string;
}
