import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsNumber, IsOptional, IsUUID, Max, Min } from "class-validator";

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

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: "NUMERIC questions: the typed answer; null clears it",
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 })
  @Min(-1e9)
  @Max(1e9)
  numericAnswer?: number | null;
}
