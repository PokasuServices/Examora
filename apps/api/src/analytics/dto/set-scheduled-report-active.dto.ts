import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class SetScheduledReportActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}
