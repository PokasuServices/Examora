import { ApiProperty } from "@nestjs/swagger";
import { IsISO8601 } from "class-validator";

export class ScheduleCmsContentDto {
  @ApiProperty({ description: "ISO 8601 timestamp to fire the transition at" })
  @IsISO8601()
  at!: string;
}
