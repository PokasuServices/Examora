import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreateReplyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(20000)
  body!: string;

  @ApiPropertyOptional({ description: "Set to nest this reply under another reply" })
  @IsOptional()
  @IsUUID()
  parentReplyId?: string;
}
