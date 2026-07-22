import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString, IsUUID, MaxLength } from "class-validator";
import { COMMUNITY_TARGET_TYPES, type CommunityTargetType } from "@examora/types";

export class CreateReportDto {
  @ApiProperty({ enum: COMMUNITY_TARGET_TYPES })
  @IsEnum(COMMUNITY_TARGET_TYPES)
  targetType!: CommunityTargetType;

  @ApiProperty()
  @IsUUID()
  targetId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  reason!: string;
}
