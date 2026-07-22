import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { THREAD_TYPES, type ThreadType } from "@examora/types";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class SearchCommunityQueryDto extends PaginationQueryDto {
  @ApiProperty({ description: "Matched against thread title and body" })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  q!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  boardId?: string;

  @ApiPropertyOptional({ enum: THREAD_TYPES })
  @IsOptional()
  @IsEnum(THREAD_TYPES)
  type?: ThreadType;
}
