import { ApiPropertyOptional } from "@nestjs/swagger";
import { ROLE_NAMES, type RoleName } from "@examora/types";
import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ROLE_NAMES, description: "Filter to users holding this role" })
  @IsOptional()
  @IsIn(ROLE_NAMES)
  role?: RoleName;
}
