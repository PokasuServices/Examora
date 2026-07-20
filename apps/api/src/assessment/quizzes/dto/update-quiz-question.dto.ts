import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsUUID, Min } from "class-validator";

/** Reassign section/marks/position for an existing quiz-question assignment; the question itself is fixed. */
export class UpdateQuizQuestionDto {
  @ApiPropertyOptional({ description: "null clears the section" })
  @IsOptional()
  @IsUUID("4")
  sectionId?: string;

  @ApiPropertyOptional({ minimum: 0.01 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  marks?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
