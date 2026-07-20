import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListCatalogCoursesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter by category id" })
  @IsOptional()
  @IsUUID("4")
  categoryId?: string;

  @ApiPropertyOptional({ description: "Filter by exam type" })
  @IsOptional()
  @IsString()
  examType?: string;
}
