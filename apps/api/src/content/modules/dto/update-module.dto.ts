import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateModuleDto } from "./create-module.dto";

export class UpdateModuleDto extends PartialType(OmitType(CreateModuleDto, ["topicId"] as const)) {}
