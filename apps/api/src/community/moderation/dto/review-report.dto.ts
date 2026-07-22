import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export class ReviewReportDto {
  @ApiProperty({ enum: ["REVIEWED", "DISMISSED"] })
  @IsIn(["REVIEWED", "DISMISSED"])
  status!: "REVIEWED" | "DISMISSED";
}
