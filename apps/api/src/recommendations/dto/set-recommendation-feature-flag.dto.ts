import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class SetRecommendationFeatureFlagDto {
  @ApiProperty()
  @IsBoolean()
  isEnabled!: boolean;
}
