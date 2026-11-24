import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class PastPaperStatRowDto {
  @ApiProperty({ example: "NID B.Des" })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  examLabel!: string;

  @ApiProperty()
  @IsUUID("4")
  subjectId!: string;

  @ApiProperty({ example: 2024 })
  @IsInt()
  @Min(1990)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(0)
  @Max(1000)
  questionCount!: number;
}

/** Replaces a course's whole syllabus heatmap (every exam label, subject and year). */
export class ReplacePastPaperStatsDto {
  @ApiProperty({ type: [PastPaperStatRowDto] })
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => PastPaperStatRowDto)
  rows!: PastPaperStatRowDto[];
}
