import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export class ReviewRefundDto {
  @ApiProperty({ enum: ["APPROVED", "DENIED"] })
  @IsIn(["APPROVED", "DENIED"])
  status!: "APPROVED" | "DENIED";
}
