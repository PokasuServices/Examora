import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  DIFFICULTY_LEVELS,
  QUESTION_TYPES,
  type DifficultyLevel,
  type QuestionType,
} from "@examora/types";
import { QuestionOptionInputDto } from "./question-option-input.dto";
import { ExplanationStepDto, QuestionResourceDto } from "./question-resource.dto";

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

  @ApiPropertyOptional({ description: "Shown after submit; markdown, may embed images" })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  explanation?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Question image: https URL or "media:<assetId>"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "NUMERIC: lowest accepted answer (inclusive)",
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 })
  numericMin?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "NUMERIC: highest accepted answer (inclusive)",
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 })
  numericMax?: number | null;

  @ApiPropertyOptional({
    description: "MULTIPLE_CHOICE: award partial marks for an incomplete but correct selection",
  })
  @IsOptional()
  @IsBoolean()
  partialMarking?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  explanationImageUrl?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'YouTube/Vimeo link, https video URL or "media:<assetId>"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  explanationVideoUrl?: string | null;

  @ApiPropertyOptional({
    type: [ExplanationStepDto],
    description: "Step-by-step explanation images, in order",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ExplanationStepDto)
  explanationSteps?: ExplanationStepDto[];

  @ApiPropertyOptional({ type: [QuestionResourceDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => QuestionResourceDto)
  resources?: QuestionResourceDto[];

  @ApiPropertyOptional({ nullable: true, description: "Topic the question tests" })
  @IsOptional()
  @IsUUID("4")
  topicId?: string | null;

  @ApiPropertyOptional({ type: [String], description: "UPLOAD: criteria a sketch is rated on" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  criteria?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @ApiProperty({
    type: [QuestionOptionInputDto],
    minItems: 2,
    maxItems: 10,
    description: "Not used by NUMERIC questions (send an empty array)",
  })
  // NUMERIC questions have no options; the service rejects any it is sent.
  @ValidateIf((o: CreateQuestionDto) => o.type !== "NUMERIC" && o.type !== "UPLOAD")
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionInputDto)
  options!: QuestionOptionInputDto[];
}
