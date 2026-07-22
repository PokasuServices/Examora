import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class HideContentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  reason!: string;
}
