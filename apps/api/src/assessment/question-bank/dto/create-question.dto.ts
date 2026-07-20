import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import {
  DIFFICULTY_LEVELS,
  QUESTION_TYPES,
  type DifficultyLevel,
  type QuestionType,
} from "@examora/types";
import { QuestionOptionInputDto } from "./question-option-input.dto";

export class CreateQuestionDto {
  @ApiPropertyOptional({ description: "Classifying subject id (reuses the curriculum taxonomy)" })
  @IsOptional()
  @IsUUID("4")
  subjectId?: string;

  @ApiProperty({ enum: QUESTION_TYPES })
  @IsIn(QUESTION_TYPES)
  type!: QuestionType;

  @ApiPropertyOptional({ enum: DIFFICULTY_LEVELS, default: "MEDIUM" })
  @IsOptional()
  @IsIn(DIFFICULTY_LEVELS)
  difficulty?: DifficultyLevel;

  @ApiProperty({ example: "Which of these is a primary color?" })
  @IsString()
  @MaxLength(2000)
  text!: string;

  @ApiPropertyOptional({ description: "Shown to the student during post-submit review" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  explanation?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiProperty({ type: [QuestionOptionInputDto], minItems: 2, maxItems: 10 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionInputDto)
  options!: QuestionOptionInputDto[];
}
