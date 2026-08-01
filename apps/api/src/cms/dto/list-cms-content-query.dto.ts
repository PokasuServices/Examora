import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { CMS_WORKFLOW_STATUSES, type CmsWorkflowStatus } from "@examora/types";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class ListCmsContentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CMS_WORKFLOW_STATUSES })
  @IsOptional()
  @IsIn(CMS_WORKFLOW_STATUSES)
  status?: CmsWorkflowStatus;
}
