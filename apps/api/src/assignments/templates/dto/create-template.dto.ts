import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { FileRulesDto } from "../../dto/file-rules.dto";
import { RubricItemDto } from "../../dto/rubric-item.dto";

export class CreateTemplateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(10000)
  brief!: string;

  @ApiProperty({ type: FileRulesDto })
  @ValidateNested()
  @Type(() => FileRulesDto)
  fileRules!: FileRulesDto;

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  marksTotal!: number;

  @ApiProperty({ type: [RubricItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RubricItemDto)
  rubric!: RubricItemDto[];
}
