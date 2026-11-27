import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AssessmentModule } from "../assessment/assessment.module";
import { ContentModule } from "../content/content.module";
import { NotificationModule } from "../notifications/notification.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { SketchesModule } from "../sketches/sketches.module";
import { UsersModule } from "../users/users.module";
import { AttendanceService } from "./attendance.service";
import { ContentReviewInterceptor } from "./content-review.interceptor";
import { DeskNotifier } from "./desk-notifier.service";
import { DeskService } from "./desk.service";
import { EngagementService } from "./engagement.service";
import { ExcelService } from "./excel.service";
import { InsightsService } from "./insights.service";
import {
  MentorDeskController,
  MentorOversightController,
  StaffRequestsController,
  StudentDeskController,
} from "./mentor-desk.controller";
import { QuizToolsService } from "./quiz-tools.service";
import { StaffRequestsService } from "./staff-requests.service";

/**
 * Mentor module: attendance, mentor home, review inbox, doubts, daily quiz
 * calendar, quiz-to-batch publishing, duplicate check, Excel toolkit, reports,
 * shout-outs, announcements and the admin approvals for mentor requests.
 */
@Module({
  imports: [
    ContentModule,
    AssessmentModule,
    SketchesModule,
    NotificationModule,
    UsersModule,
    PermissionsModule,
  ],
  controllers: [
    MentorDeskController,
    StaffRequestsController,
    MentorOversightController,
    StudentDeskController,
  ],
  providers: [
    AttendanceService,
    DeskService,
    DeskNotifier,
    EngagementService,
    ExcelService,
    InsightsService,
    QuizToolsService,
    StaffRequestsService,
    { provide: APP_INTERCEPTOR, useClass: ContentReviewInterceptor },
  ],
  exports: [ExcelService],
})
export class MentorDeskModule {}
