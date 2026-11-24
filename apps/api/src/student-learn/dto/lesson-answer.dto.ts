import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ANSWER_METHODS, type AnswerMethod } from "@examora/types";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  ValidateIf,
} from "class-validator";

/** One inline answer to a lesson's practice question. */
export class LessonAnswerDto {
  @ApiPropertyOptional({ type: [String], description: "Chosen option ids (choice questions)" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID("4", { each: true })
  optionIds?: string[];

  @ApiPropertyOptional({ description: "Typed number (numeric questions)" })
  @IsOptional()
  @ValidateIf((o: LessonAnswerDto) => o.numericValue !== null)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  numericValue?: number | null;

  @ApiPropertyOptional({ enum: ANSWER_METHODS, nullable: true })
  @IsOptional()
  @ValidateIf((o: LessonAnswerDto) => o.method !== null)
  @IsIn(ANSWER_METHODS)
  method?: AnswerMethod | null;
}

export class AttachLessonQuestionDto {
  @ApiProperty()
  @IsUUID("4")
  questionId!: string;
}
