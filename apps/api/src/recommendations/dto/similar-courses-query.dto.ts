import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class SimilarCoursesQueryDto {
  @ApiPropertyOptional({ description: "Defaults to the caller's most-active enrolled course" })
  @IsOptional()
  @IsUUID()
  courseId?: string;
}
