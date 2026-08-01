import { PartialType } from "@nestjs/swagger";
import { CreateCmsAnnouncementDto } from "./create-cms-announcement.dto";

export class UpdateCmsAnnouncementDto extends PartialType(CreateCmsAnnouncementDto) {}
