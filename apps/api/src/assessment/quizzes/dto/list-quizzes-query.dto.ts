import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import { ContentListQueryDto } from "../../../content/dto/content-status-query.dto";

export class ListQuizzesQueryDto extends ContentListQueryDto {
  @ApiPropertyOptional({ description: "Filter by classifying subject id" })
  @IsOptional()
  @IsUUID("4")
  subjectId?: string;
}
