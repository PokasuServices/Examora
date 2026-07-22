import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsIn, IsOptional, IsUUID } from "class-validator";
import { THREAD_STATUSES, THREAD_TYPES, type ThreadStatus, type ThreadType } from "@examora/types";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListThreadsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  boardId?: string;

  @ApiPropertyOptional({ enum: THREAD_TYPES })
  @IsOptional()
  @IsEnum(THREAD_TYPES)
  type?: ThreadType;

  @ApiPropertyOptional({ enum: THREAD_STATUSES })
  @IsOptional()
  @IsEnum(THREAD_STATUSES)
  status?: ThreadStatus;

  @ApiPropertyOptional({ enum: ["true", "false"] })
  @IsOptional()
  @IsIn(["true", "false"])
  solved?: "true" | "false";

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  authorId?: string;
}
