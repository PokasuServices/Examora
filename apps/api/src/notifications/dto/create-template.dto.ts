import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { NOTIFICATION_CHANNELS, type NotificationChannel } from "@examora/types";

export class CreateTemplateDto {
  @ApiProperty({ example: "commerce.payment_success" })
  @IsString()
  @MaxLength(100)
  eventType!: string;

  @ApiProperty({ enum: NOTIFICATION_CHANNELS })
  @IsIn(NOTIFICATION_CHANNELS)
  channel!: NotificationChannel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({ description: "Plain text with {{placeholder}} variables" })
  @IsString()
  @MaxLength(5000)
  bodyTemplate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
