import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class QuestionResourceDto {
  @ApiProperty({ example: "Panton Chair" })
  @IsString()
  @MaxLength(120)
  label!: string;

  @ApiProperty({ example: "https://en.wikipedia.org/wiki/Panton_Chair" })
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(500)
  url!: string;
}

/** One image of a step-by-step explanation. */
export class ExplanationStepDto {
  @ApiProperty({ description: 'https image URL or "media:<assetId>"' })
  @IsString()
  @MaxLength(500)
  imageUrl!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  caption?: string | null;
}
