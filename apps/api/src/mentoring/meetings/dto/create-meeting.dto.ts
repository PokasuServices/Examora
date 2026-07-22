import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateMeetingDto {
  @ApiProperty()
  @IsDateString()
  occurredAt!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 480 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  summary?: string;
}
