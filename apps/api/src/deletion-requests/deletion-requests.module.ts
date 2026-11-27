import { Module } from "@nestjs/common";
import { AssessmentModule } from "../assessment/assessment.module";
import { AssignmentsModule } from "../assignments/assignments.module";
import { CollegesModule } from "../colleges/colleges.module";
import { ContentModule } from "../content/content.module";
import { NotificationModule } from "../notifications/notification.module";
import { PracticeModule } from "../practice/practice.module";
import { SketchesModule } from "../sketches/sketches.module";
import { StudentProfileModule } from "../student-profile/student-profile.module";
import { DeletionRequestsController } from "./deletion-requests.controller";
import { DeletionRequestsService } from "./deletion-requests.service";
import { DeletionTargets } from "./deletion-targets";

/** Mentors ask, administrators decide (mentor module, MF0). */
@Module({
  imports: [
    ContentModule,
    AssessmentModule,
    AssignmentsModule,
    PracticeModule,
    SketchesModule,
    StudentProfileModule,
    CollegesModule,
    NotificationModule,
  ],
  controllers: [DeletionRequestsController],
  providers: [DeletionRequestsService, DeletionTargets],
})
export class DeletionRequestsModule {}
