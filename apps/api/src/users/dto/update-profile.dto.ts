import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ required: false, example: "2008-05-14" })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  guardianName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  guardianEmail?: string;
}
