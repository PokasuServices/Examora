import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListMentorAssignmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4")
  studentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4")
  mentorId?: string;
}
