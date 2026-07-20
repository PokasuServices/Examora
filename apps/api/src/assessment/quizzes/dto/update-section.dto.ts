import { PartialType } from "@nestjs/swagger";
import { CreateQuizSectionDto } from "./create-section.dto";

export class UpdateQuizSectionDto extends PartialType(CreateQuizSectionDto) {}
