import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class QuestionOptionInputDto {
  @ApiProperty({ example: "Red", description: "May be empty when the option is an image" })
  @IsString()
  @MaxLength(500)
  text!: string;

  @ApiProperty()
  @IsBoolean()
  isCorrect!: boolean;

  @ApiPropertyOptional({ nullable: true, description: 'Image: an https URL or "media:<assetId>"' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;
}
