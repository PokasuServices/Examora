import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Min } from "class-validator";
import { RubricItemDto } from "../../dto/rubric-item.dto";

export class CreateCriterionDto extends RubricItemDto {
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
