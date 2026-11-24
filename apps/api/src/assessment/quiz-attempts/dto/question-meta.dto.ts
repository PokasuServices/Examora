import { ApiPropertyOptional } from "@nestjs/swagger";
import { ANSWER_METHODS, type AnswerMethod } from "@examora/types";
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min, ValidateIf } from "class-validator";

/** Test-screen bookkeeping for one question (visit, flag, answer method, time). */
export class QuestionMetaDto {
  @ApiPropertyOptional({ description: "Mark the question as opened" })
  @IsOptional()
  @IsBoolean()
  visited?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  flagged?: boolean;

  @ApiPropertyOptional({ enum: ANSWER_METHODS, nullable: true })
  @IsOptional()
  @ValidateIf((o: QuestionMetaDto) => o.method !== null)
  @IsIn(ANSWER_METHODS)
  method?: AnswerMethod | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 600, description: "Seconds to add to time spent" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  addSeconds?: number;
}
