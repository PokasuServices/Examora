import { ApiPropertyOptional } from "@nestjs/swagger";
import { ASSIGNMENT_SUBMISSION_STATUSES, type AssignmentSubmissionStatus } from "@examora/types";
import { IsIn, IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListAdminSubmissionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4")
  assignmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4")
  reviewerId?: string;

  @ApiPropertyOptional({ enum: ASSIGNMENT_SUBMISSION_STATUSES })
  @IsOptional()
  @IsIn(ASSIGNMENT_SUBMISSION_STATUSES)
  status?: AssignmentSubmissionStatus;
}
