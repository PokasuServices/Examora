import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateSubjectDto } from "./create-subject.dto";

// courseId is fixed at creation — a subject cannot be re-parented to another
// course via a general update (would orphan its topic subtree semantics).
export class UpdateSubjectDto extends PartialType(
  OmitType(CreateSubjectDto, ["courseId"] as const),
) {}
