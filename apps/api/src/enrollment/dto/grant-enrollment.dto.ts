import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class GrantEnrollmentDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty()
  @IsUUID()
  courseId!: string;
}
