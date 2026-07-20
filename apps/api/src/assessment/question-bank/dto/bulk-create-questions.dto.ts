import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from "class-validator";
import { CreateQuestionDto } from "./create-question.dto";

/** Bulk-import foundation (Sprint 4 scope: schema/endpoint only, no file/CSV pipeline — TD tracked). */
export class BulkCreateQuestionsDto {
  @ApiProperty({ type: [CreateQuestionDto], minItems: 1, maxItems: 500 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions!: CreateQuestionDto[];
}
