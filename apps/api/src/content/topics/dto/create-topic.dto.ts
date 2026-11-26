import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

export class CreateTopicDto {
  @ApiProperty({ description: "Owning subject id" })
  @IsUUID("4")
  subjectId!: string;

  @ApiProperty({ example: "Mensuration" })
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

  @ApiPropertyOptional({
    type: [String],
    example: ["NID", "UCEED", "NATA"],
    description: "Exams this topic is part of; two or more makes it a shared topic",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? [...new Set(value.map((v) => String(v).trim().toUpperCase()).filter(Boolean))]
      : value,
  )
  examTags?: string[];
}
