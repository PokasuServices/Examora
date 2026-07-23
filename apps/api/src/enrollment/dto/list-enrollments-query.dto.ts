import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsUUID } from "class-validator";
import { ENROLLMENT_STATUSES, type EnrollmentStatus } from "@examora/types";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListEnrollmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({ enum: ENROLLMENT_STATUSES })
  @IsOptional()
  @IsEnum(ENROLLMENT_STATUSES)
  status?: EnrollmentStatus;
}
