import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class AcceptAnswerDto {
  @ApiProperty()
  @IsUUID()
  replyId!: string;
}
