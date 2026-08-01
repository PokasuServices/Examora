import { PartialType, OmitType } from "@nestjs/swagger";
import { CreateCmsPageDto } from "./create-cms-page.dto";

export class UpdateCmsPageDto extends PartialType(
  OmitType(CreateCmsPageDto, ["pageType"] as const),
) {}
