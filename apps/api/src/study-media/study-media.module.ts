import { Module } from "@nestjs/common";
import { CmsModule } from "../cms/cms.module";
import { StudyMediaController } from "./study-media.controller";
import { StudyMediaService } from "./study-media.service";

/** Uploaded images/videos for study content (student module redesign). */
@Module({
  imports: [CmsModule],
  controllers: [StudyMediaController],
  providers: [StudyMediaService],
})
export class StudyMediaModule {}
