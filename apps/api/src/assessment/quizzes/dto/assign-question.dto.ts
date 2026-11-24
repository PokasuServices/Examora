import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsUUID, Min } from "class-validator";

export class AssignQuestionDto {
  @ApiProperty({ description: "Question to assign — must be PUBLISHED" })
  @IsUUID("4")
  questionId!: string;

  @ApiPropertyOptional({ description: "Section to place this question in" })
  @IsOptional()
  @IsUUID("4")
  sectionId?: string;

  @ApiPropertyOptional({
    default: 1,
    minimum: 0.01,
    description: "Marks for this question in this quiz",
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  marks?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({
    nullable: true,
    minimum: 0,
    description:
      "Marks deducted for a wrong answer to this question; overrides the quiz-wide rule. null = use the quiz rule",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  negativeMarks?: number | null;
}
