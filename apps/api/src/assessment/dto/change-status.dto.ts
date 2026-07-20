import { ApiProperty } from "@nestjs/swagger";
import { CONTENT_STATUSES, type ContentStatus } from "@examora/types";
import { IsIn } from "class-validator";

/** Shared status-change payload for Question and Quiz — both reuse ContentStatus (ADR-0012/0014). */
export class ChangeStatusDto {
  @ApiProperty({ enum: CONTENT_STATUSES })
  @IsIn(CONTENT_STATUSES)
  status!: ContentStatus;
}
