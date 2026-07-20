import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsUUID } from "class-validator";

export class AutosaveAnswerDto {
  @ApiProperty()
  @IsUUID("4")
  questionId!: string;

  @ApiProperty({
    type: [String],
    description: "Selected option ids; empty array clears the answer",
  })
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID("4", { each: true })
  selectedOptionIds!: string[];
}
