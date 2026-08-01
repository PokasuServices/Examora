import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { CMS_WORKFLOW_STATUSES, type CmsWorkflowStatus } from "@examora/types";

export class TransitionCmsContentDto {
  @ApiProperty({ enum: CMS_WORKFLOW_STATUSES })
  @IsIn(CMS_WORKFLOW_STATUSES)
  targetStatus!: CmsWorkflowStatus;
}
