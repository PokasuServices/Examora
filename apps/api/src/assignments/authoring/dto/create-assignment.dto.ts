import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { FileRulesDto } from "../../dto/file-rules.dto";

export class CreateAssignmentDto {
  @ApiPropertyOptional({ description: "Classifying subject id (reuses the curriculum taxonomy)" })
  @IsOptional()
  @IsUUID("4")
  subjectId?: string;

  @ApiPropertyOptional({ description: "Copy brief/fileRules/marksTotal/rubric from this template" })
  @IsOptional()
  @IsUUID("4")
  templateId?: string;

  @ApiProperty({ example: "Poster Design: Sustainability" })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ description: "URL-safe slug; derived from title if omitted" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "slug must be lowercase-hyphenated" })
  slug?: string;

  @ApiPropertyOptional({ description: "Required unless templateId is supplied" })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  brief?: string;

  @ApiPropertyOptional({
    type: FileRulesDto,
    description: "Required unless templateId is supplied",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => FileRulesDto)
  fileRules?: FileRulesDto;

  @ApiPropertyOptional({ minimum: 0.01, description: "Required unless templateId is supplied" })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  marksTotal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
