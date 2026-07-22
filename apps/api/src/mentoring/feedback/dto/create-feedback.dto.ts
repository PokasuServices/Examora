import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class CreateFeedbackDto {
  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  body!: string;
}
