import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, Min, MaxLength } from "class-validator";

export class RubricItemDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  maxMarks!: number;
}
