import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class RubricScoreInputDto {
  @ApiProperty()
  @IsUUID("4")
  criterionId!: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  marksAwarded!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class SaveReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  overallComment?: string;

  @ApiProperty({ type: [RubricScoreInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RubricScoreInputDto)
  scores!: RubricScoreInputDto[];
}
