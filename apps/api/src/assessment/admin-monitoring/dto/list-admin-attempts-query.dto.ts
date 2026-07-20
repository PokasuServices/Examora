import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsUUID } from "class-validator";
import { QUIZ_ATTEMPT_STATUSES, type QuizAttemptStatus } from "@examora/types";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListAdminAttemptsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter by quiz" })
  @IsOptional()
  @IsUUID("4")
  quizId?: string;

  @ApiPropertyOptional({ description: "Filter by student" })
  @IsOptional()
  @IsUUID("4")
  userId?: string;

  @ApiPropertyOptional({ enum: QUIZ_ATTEMPT_STATUSES })
  @IsOptional()
  @IsIn(QUIZ_ATTEMPT_STATUSES)
  status?: QuizAttemptStatus;
}
