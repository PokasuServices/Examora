import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class StartSubmissionDto {
  @ApiProperty({ description: "Must reference a PUBLISHED assignment" })
  @IsUUID("4")
  assignmentId!: string;
}
