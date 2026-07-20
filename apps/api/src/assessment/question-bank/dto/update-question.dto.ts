import { PartialType } from "@nestjs/swagger";
import { CreateQuestionDto } from "./create-question.dto";

// Status is intentionally excluded — it changes only via the dedicated
// PATCH :id/status endpoint (question:manage), not general edits.
export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}
