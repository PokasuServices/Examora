import { PartialType } from "@nestjs/swagger";
import { CreateCmsBannerDto } from "./create-cms-banner.dto";

export class UpdateCmsBannerDto extends PartialType(CreateCmsBannerDto) {}
