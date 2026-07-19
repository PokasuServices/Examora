import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class ResendVerificationDto {
  @ApiProperty({ example: "student@example.com" })
  @IsEmail()
  email!: string;
}
