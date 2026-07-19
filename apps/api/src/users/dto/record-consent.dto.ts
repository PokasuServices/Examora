import { ApiProperty } from "@nestjs/swagger";
import { CONSENT_TYPES, type ConsentType } from "@examora/types";
import { IsBoolean, IsIn, IsString } from "class-validator";

export class RecordConsentDto {
  @ApiProperty({ enum: CONSENT_TYPES })
  @IsIn(CONSENT_TYPES)
  type!: ConsentType;

  @ApiProperty({ example: "v1.0" })
  @IsString()
  version!: string;

  @ApiProperty({ example: "web" })
  @IsString()
  channel!: string;

  @ApiProperty()
  @IsBoolean()
  granted!: boolean;
}
