import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateAssignmentDto } from "./create-assignment.dto";

// templateId only makes sense at creation; status changes only via PATCH :id/status.
export class UpdateAssignmentDto extends PartialType(
  OmitType(CreateAssignmentDto, ["templateId"]),
) {}
