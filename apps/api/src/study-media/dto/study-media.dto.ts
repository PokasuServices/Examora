import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsPositive, IsString, Matches, MaxLength } from "class-validator";

export class PresignStudyMediaDto {
  @ApiProperty({ example: "vase-sections.png" })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: "image/png" })
  @IsString()
  @MaxLength(100)
  mimeType!: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  sizeBytes!: number;
}

export class ConfirmStudyMediaDto extends PresignStudyMediaDto {
  @ApiProperty({ description: "The storage key returned by the presign step" })
  @IsString()
  @MaxLength(500)
  @Matches(/^study-media\//, { message: "storageKey must come from the study-media presign step" })
  storageKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  altText?: string;
}
