import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { DIFFICULTY_LEVELS, type DifficultyLevel } from "@examora/types";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateQuizDto {
  @ApiPropertyOptional({ description: "Classifying subject id (reuses the curriculum taxonomy)" })
  @IsOptional()
  @IsUUID("4")
  subjectId?: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "Topic for a Learn-page topic quiz (must be in the quiz's subject); null for tests",
  })
  @IsOptional()
  @IsUUID("4")
  topicId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    minimum: 1,
    description: "Attempts allowed; null = unlimited",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxAttempts?: number | null;

  @ApiPropertyOptional({ default: 0, minimum: 0, description: "XP for the first finished attempt" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  xpReward?: number;

  @ApiPropertyOptional({ enum: DIFFICULTY_LEVELS, nullable: true })
  @IsOptional()
  @IsIn(DIFFICULTY_LEVELS)
  level?: DifficultyLevel | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Practice page category (same course as the subject)",
  })
  @IsOptional()
  @IsUUID("4")
  practiceCategoryId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Locked until the student finishes this other quiz",
  })
  @IsOptional()
  @IsUUID("4")
  unlockAfterQuizId?: string | null;

  @ApiPropertyOptional({
    default: false,
    description: "Every question must be opened before submitting",
  })
  @IsOptional()
  @IsBoolean()
  requireAllVisited?: boolean;

  @ApiProperty({ example: "NID UG Mock Test 1" })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ description: "URL-safe slug; derived from title if omitted" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "slug must be lowercase-hyphenated" })
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ description: "Null/omitted = untimed", minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimitMinutes?: number;

  @ApiPropertyOptional({ default: 40, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passingScorePercent?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  negativeMarkingEnabled?: boolean;

  @ApiPropertyOptional({
    default: 0,
    minimum: 0,
    maximum: 1,
    description: "Fraction of a question's marks deducted per wrong answer, e.g. 0.25",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  negativeMarksPerWrong?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
