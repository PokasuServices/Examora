import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";
import { ContentListQueryDto } from "../../dto/content-status-query.dto";

export class ListCoursesQueryDto extends ContentListQueryDto {
  @ApiPropertyOptional({ description: "Filter by owning category id" })
  @IsOptional()
  @IsUUID("4")
  categoryId?: string;

  @ApiPropertyOptional({ description: "Filter by exam type" })
  @IsOptional()
  @IsString()
  examType?: string;
}
