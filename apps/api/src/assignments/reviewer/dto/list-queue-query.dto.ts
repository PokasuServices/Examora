import { ApiPropertyOptional } from "@nestjs/swagger";
import { ASSIGNMENT_SUBMISSION_STATUSES, type AssignmentSubmissionStatus } from "@examora/types";
import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListQueueQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ASSIGNMENT_SUBMISSION_STATUSES })
  @IsOptional()
  @IsIn(ASSIGNMENT_SUBMISSION_STATUSES)
  status?: AssignmentSubmissionStatus;
}
