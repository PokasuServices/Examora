import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Min, MaxLength } from "class-validator";

export class PresignFileDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: "image/png" })
  @IsString()
  @MaxLength(100)
  mimeType!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
