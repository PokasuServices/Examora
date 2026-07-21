import { ApiProperty } from "@nestjs/swagger";
import { REVIEW_DECISIONS, type ReviewDecision } from "@examora/types";
import { IsIn } from "class-validator";

export class PublishReviewDto {
  @ApiProperty({ enum: REVIEW_DECISIONS })
  @IsIn(REVIEW_DECISIONS)
  decision!: ReviewDecision;
}
