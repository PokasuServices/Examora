import { PartialType } from "@nestjs/swagger";
import { CreateQuizDto } from "./create-quiz.dto";

// Status is intentionally excluded — it changes only via the dedicated
// PATCH :id/status endpoint (quiz:publish), not general edits.
export class UpdateQuizDto extends PartialType(CreateQuizDto) {}
