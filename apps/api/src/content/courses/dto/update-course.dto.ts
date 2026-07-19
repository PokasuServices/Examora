import { PartialType } from "@nestjs/swagger";
import { CreateCourseDto } from "./create-course.dto";

// Status is intentionally excluded — it changes only via the dedicated
// PATCH :id/status endpoint (gated by content:publish), not general edits.
export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
