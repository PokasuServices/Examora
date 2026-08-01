import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class SearchCmsContentQueryDto extends PaginationQueryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  q!: string;
}
