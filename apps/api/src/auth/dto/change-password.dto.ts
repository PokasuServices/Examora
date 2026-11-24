import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDto {
  /** Required when the account already has a password (not for Google-only accounts). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentPassword?: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newPassword!: string;
}
