import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class UpdateReplyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(20000)
  body!: string;
}
