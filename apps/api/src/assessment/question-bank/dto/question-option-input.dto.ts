import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsString, MaxLength } from "class-validator";

export class QuestionOptionInputDto {
  @ApiProperty({ example: "Red" })
  @IsString()
  @MaxLength(500)
  text!: string;

  @ApiProperty()
  @IsBoolean()
  isCorrect!: boolean;
}
