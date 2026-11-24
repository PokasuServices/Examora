import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SUBJECT_COLORS, SUBJECT_ICONS } from "@examora/types";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

export class CreateSubjectDto {
  @ApiProperty({ description: "Owning course id" })
  @IsUUID("4")
  courseId!: string;

  @ApiProperty({ example: "Visual Spatial Ability" })
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

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ enum: ["SUBJECT", "ESSENTIALS"], default: "SUBJECT" })
  @IsOptional()
  @IsIn(["SUBJECT", "ESSENTIALS"])
  kind?: "SUBJECT" | "ESSENTIALS";

  @ApiPropertyOptional({ enum: SUBJECT_ICONS, nullable: true })
  @IsOptional()
  @IsIn(SUBJECT_ICONS)
  icon?: string | null;

  @ApiPropertyOptional({ enum: SUBJECT_COLORS, nullable: true })
  @IsOptional()
  @IsIn(SUBJECT_COLORS)
  color?: string | null;
}
