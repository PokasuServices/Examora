import { ApiProperty } from "@nestjs/swagger";
import { Equals, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "student@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: "a-strong-password" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  /** Consent capture per FR-PROFILE-01: version, channel, timestamp(now), actor(self). */
  @ApiProperty({ example: "v1.0", description: "Version of the Terms of Service being accepted" })
  @IsString()
  consentVersion!: string;

  @ApiProperty({ example: true })
  @Equals(true, { message: "You must accept the Terms of Service to register" })
  acceptTerms!: boolean;
}
