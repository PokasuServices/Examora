import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsUrl, MaxLength } from "class-validator";

export class QuestionResourceDto {
  @ApiProperty({ example: "Panton Chair" })
  @IsString()
  @MaxLength(120)
  label!: string;

  @ApiProperty({ example: "https://en.wikipedia.org/wiki/Panton_Chair" })
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(500)
  url!: string;
}
