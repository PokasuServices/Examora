import { PartialType } from "@nestjs/swagger";
import { CreateCmsFaqItemDto } from "./create-cms-faq-item.dto";

export class UpdateCmsFaqItemDto extends PartialType(CreateCmsFaqItemDto) {}
