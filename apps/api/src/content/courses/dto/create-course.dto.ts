import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

export class CreateCourseDto {
  @ApiPropertyOptional({ description: "Owning category id" })
  @IsOptional()
  @IsUUID("4")
  categoryId?: string;

  @ApiProperty({ example: "NID UG · UCEED Foundation" })
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

  @ApiPropertyOptional({ example: "NID", description: "Exam family / type" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  examType?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({
    description: "Sprint 8 (ADR-0018): omit or leave unset for a free course",
    example: 1499,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  priceAmount?: number;

  @ApiPropertyOptional({ default: "INR" })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  priceCurrency?: string;
}
