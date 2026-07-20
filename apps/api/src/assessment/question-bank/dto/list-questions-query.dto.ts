import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import {
  CONTENT_STATUSES,
  DIFFICULTY_LEVELS,
  QUESTION_TYPES,
  type ContentStatus,
  type DifficultyLevel,
  type QuestionType,
} from "@examora/types";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListQuestionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CONTENT_STATUSES })
  @IsOptional()
  @IsIn(CONTENT_STATUSES)
  status?: ContentStatus;

  @ApiPropertyOptional({ description: "Filter by classifying subject id" })
  @IsOptional()
  @IsUUID("4")
  subjectId?: string;

  @ApiPropertyOptional({ enum: QUESTION_TYPES })
  @IsOptional()
  @IsIn(QUESTION_TYPES)
  type?: QuestionType;

  @ApiPropertyOptional({ enum: DIFFICULTY_LEVELS })
  @IsOptional()
  @IsIn(DIFFICULTY_LEVELS)
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional({ description: "Filter to questions carrying this tag" })
  @IsOptional()
  @IsString()
  tag?: string;
}
