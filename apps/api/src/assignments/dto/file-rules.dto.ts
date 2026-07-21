import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, Max, Min } from "class-validator";

export class FileRulesDto {
  @ApiProperty({ type: [String], example: ["image/jpeg", "image/png", "application/pdf"] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  allowedMimeTypes!: string[];

  @ApiProperty({ minimum: 1, maximum: 500 })
  @IsInt()
  @Min(1)
  @Max(500)
  maxFileSizeMb!: number;

  @ApiProperty({ minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  maxFiles!: number;
}
