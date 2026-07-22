import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class AssignMentorDto {
  @ApiProperty({ description: "Must be a user with the MENTOR role" })
  @IsUUID("4")
  mentorId!: string;
}
