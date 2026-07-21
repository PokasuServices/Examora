import { ApiProperty } from "@nestjs/swagger";
import { CONTENT_STATUSES, type ContentStatus } from "@examora/types";
import { IsIn } from "class-validator";

/** Assignment status changes reuse ContentStatus (ADR-0012/0015). */
export class ChangeStatusDto {
  @ApiProperty({ enum: CONTENT_STATUSES })
  @IsIn(CONTENT_STATUSES)
  status!: ContentStatus;
}
