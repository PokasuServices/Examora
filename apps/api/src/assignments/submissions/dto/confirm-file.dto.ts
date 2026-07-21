import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Min, MaxLength } from "class-validator";

export class ConfirmFileDto {
  @ApiProperty({ description: "The storage key returned by the presign step" })
  @IsString()
  @MaxLength(500)
  key!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  mimeType!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
