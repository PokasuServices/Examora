import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from "class-validator";

/**
 * Assign or remove course licences in bulk (student module redesign:
 * students don't buy courses, an administrator assigns them). Target either
 * every student (`allStudents: true`) or the listed `userIds`.
 */
export class BulkLicenceDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID("4", { each: true })
  courseIds!: string[];

  @ApiPropertyOptional({ description: "Apply to every user with the STUDENT role" })
  @IsOptional()
  @IsBoolean()
  allStudents?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10000)
  @IsUUID("4", { each: true })
  userIds?: string[];

  @ApiPropertyOptional({ description: "Apply to every member of this cohort" })
  @IsOptional()
  @IsUUID("4")
  cohortId?: string;
}
