import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { CMS_PAGE_TYPES, type CmsPageType } from "@examora/types";
import { ListCmsContentQueryDto } from "./list-cms-content-query.dto";

export class ListCmsPagesQueryDto extends ListCmsContentQueryDto {
  @ApiPropertyOptional({ enum: CMS_PAGE_TYPES })
  @IsOptional()
  @IsIn(CMS_PAGE_TYPES)
  pageType?: CmsPageType;
}
