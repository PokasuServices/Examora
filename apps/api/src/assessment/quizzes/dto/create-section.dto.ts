import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from "class-validator";

export class CreateQuizSectionDto {
  @ApiProperty({ example: "Section A: Verbal Reasoning" })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({
    nullable: true,
    minimum: 1,
    description: "Own time for this section in minutes (null = shares the test's time)",
  })
  @IsOptional()
  @ValidateIf((o: CreateQuizSectionDto) => o.timeLimitMinutes !== null)
  @IsInt()
  @Min(1)
  @Max(600)
  timeLimitMinutes?: number | null;
}
