import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class AssignReviewerDto {
  @ApiProperty({ description: "Must be a user with the MENTOR or REVIEWER role" })
  @IsUUID("4")
  reviewerId!: string;
}
