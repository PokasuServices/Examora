import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class StartAttemptDto {
  @ApiProperty({ description: "Must reference a PUBLISHED quiz" })
  @IsUUID("4")
  quizId!: string;
}
