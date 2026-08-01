import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { ListCmsContentQueryDto } from "./list-cms-content-query.dto";

export class ListCmsBannersQueryDto extends ListCmsContentQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placement?: string;
}
