import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListAuditLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: "User" })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorId?: string;
}
