import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateCourseDto } from "./create-course.dto";

// Status is intentionally excluded — it changes only via the dedicated
// PATCH :id/status endpoint (gated by content:publish), not general edits.
export class UpdateCourseDto extends PartialType(CreateCourseDto) {
  @ApiPropertyOptional({
    description: "Sprint 8 (ADR-0018): set true to clear pricing and make the course free again",
  })
  @IsOptional()
  @IsBoolean()
  isFree?: boolean;
}
