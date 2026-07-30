import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { NOTIFICATION_CHANNELS, type NotificationChannel } from "@examora/types";

export class BroadcastDto {
  @ApiProperty({
    type: [String],
    description: "Target user ids (cohort or platform-wide selection)",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10_000)
  @IsUUID("4", { each: true })
  userIds!: string[];

  @ApiProperty({ example: "platform.broadcast_announcement" })
  @IsString()
  @MaxLength(100)
  eventType!: string;

  @ApiProperty({ example: "platform" })
  @IsString()
  @MaxLength(50)
  category!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  body!: string;

  @ApiPropertyOptional({ enum: NOTIFICATION_CHANNELS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(NOTIFICATION_CHANNELS, { each: true })
  channels?: NotificationChannel[];
}
