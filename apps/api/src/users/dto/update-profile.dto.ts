import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

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

  @ApiProperty({ required: false, example: "9876543210" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  guardianPhone?: string;

  @ApiProperty({ required: false, example: 2027, description: "Year of the entrance exam" })
  @IsOptional()
  @IsInt()
  @Min(2020)
  @Max(2040)
  examYear?: number;
}
