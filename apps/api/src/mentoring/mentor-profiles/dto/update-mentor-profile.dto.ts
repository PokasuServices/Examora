import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateMentorProfileDto } from "./create-mentor-profile.dto";

// userId only makes sense at creation.
export class UpdateMentorProfileDto extends PartialType(
  OmitType(CreateMentorProfileDto, ["userId"]),
) {}
