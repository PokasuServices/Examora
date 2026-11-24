import { ApiPropertyOptional } from "@nestjs/swagger";
import { ROLE_NAMES, type RoleName } from "@examora/types";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ROLE_NAMES, description: "Filter to users holding this role" })
  @IsOptional()
  @IsIn(ROLE_NAMES)
  role?: RoleName;

  @ApiPropertyOptional({ description: "Case-insensitive match on email, first or last name" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
