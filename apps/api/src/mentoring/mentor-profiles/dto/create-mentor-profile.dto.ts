import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class CreateMentorProfileDto {
  @ApiProperty({ description: "Must be a user with the MENTOR role" })
  @IsUUID("4")
  userId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialization?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxStudents?: number;
}
