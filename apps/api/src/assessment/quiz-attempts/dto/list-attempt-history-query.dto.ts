import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListAttemptHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter to attempts of this quiz" })
  @IsOptional()
  @IsUUID("4")
  quizId?: string;
}
