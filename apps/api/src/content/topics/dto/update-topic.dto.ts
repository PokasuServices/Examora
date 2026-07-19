import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateTopicDto } from "./create-topic.dto";

export class UpdateTopicDto extends PartialType(OmitType(CreateTopicDto, ["subjectId"] as const)) {}
