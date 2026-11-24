import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Max, Min } from "class-validator";

export class RateTopicDto {
  @ApiProperty({ minimum: 1, maximum: 5, description: "1 = Poor … 5 = Excellent" })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;
}
