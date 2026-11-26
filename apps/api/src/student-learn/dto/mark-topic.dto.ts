import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

/** Set either or both of a student's labels on a topic. */
export class MarkTopicDto {
  @ApiPropertyOptional({ description: "Important to me" })
  @IsOptional()
  @IsBoolean()
  favourite?: boolean;

  @ApiPropertyOptional({ description: "Parked for later" })
  @IsOptional()
  @IsBoolean()
  onHold?: boolean;
}
