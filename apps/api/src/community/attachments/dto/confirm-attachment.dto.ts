import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsInt, IsPositive, IsString, IsUUID, MaxLength } from "class-validator";
import { COMMUNITY_TARGET_TYPES, type CommunityTargetType } from "@examora/types";

export class ConfirmAttachmentDto {
  @ApiProperty({ enum: COMMUNITY_TARGET_TYPES })
  @IsEnum(COMMUNITY_TARGET_TYPES)
  targetType!: CommunityTargetType;

  @ApiProperty()
  @IsUUID()
  targetId!: string;

  @ApiProperty({ description: "The storage key returned by the presign step" })
  @IsString()
  @MaxLength(500)
  storageKey!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty()
  @IsString()
  mimeType!: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  sizeBytes!: number;
}
