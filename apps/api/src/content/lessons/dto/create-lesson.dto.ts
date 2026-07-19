import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { LESSON_CONTENT_TYPES, type LessonContentType } from "@examora/types";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

export class CreateLessonDto {
  @ApiProperty({ description: "Owning module id" })
  @IsUUID("4")
  moduleId!: string;

  @ApiProperty({ example: "Introduction to Perspective" })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ description: "URL-safe slug; derived from title if omitted" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "slug must be lowercase-hyphenated" })
  slug?: string;

  @ApiPropertyOptional({ enum: LESSON_CONTENT_TYPES, default: "TEXT" })
  @IsOptional()
  @IsIn(LESSON_CONTENT_TYPES)
  contentType?: LessonContentType;

  @ApiPropertyOptional({ description: "Rich-text/markdown body for TEXT/ARTICLE lessons" })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  body?: string;

  @ApiPropertyOptional({ description: "Reference URL for VIDEO/PDF/IMAGE lessons" })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  contentUrl?: string;

  @ApiPropertyOptional({ minimum: 0, description: "Estimated duration in minutes" })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
