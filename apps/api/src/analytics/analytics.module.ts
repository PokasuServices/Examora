import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AssignmentsModule } from "../assignments/assignments.module";
import { LearningModule } from "../learning/learning.module";
import { MentoringModule } from "../mentoring/mentoring.module";
import { AdminAnalyticsController } from "./admin/admin-analytics.controller";
import { AdminAcademicAnalyticsService } from "./admin/admin-academic-analytics.service";
import { AdminCommerceAnalyticsService } from "./admin/admin-commerce-analytics.service";
import { AdminEngagementAnalyticsService } from "./admin/admin-engagement-analytics.service";
import { AdminPlatformAnalyticsService } from "./admin/admin-platform-analytics.service";
import { MentorAnalyticsController } from "./mentor/mentor-analytics.controller";
import { MentorAnalyticsService } from "./mentor/mentor-analytics.service";
import { ReportBuilderService } from "./reports/report-builder.service";
import { ReportExportService } from "./reports/report-export.service";
import { ReportsController } from "./reports/reports.controller";
import { SCHEDULED_REPORT_QUEUE } from "./reports/scheduled-report.constants";
import { ScheduledReportProcessor } from "./reports/scheduled-report.processor";
import { ScheduledReportsService } from "./reports/scheduled-reports.service";
import { StudentAnalyticsController } from "./student/student-analytics.controller";
import { StudentAnalyticsService } from "./student/student-analytics.service";

/**
 * Analytics & Reporting (Sprint 10, ADR-0020). Imports LearningModule
 * (ProgressService), AssignmentsModule (SubmissionsService), and
 * MentoringModule (MentorAssignmentService/MentorProfilesService) to reuse
 * their existing queries rather than duplicating them; everything else is a
 * direct PrismaService aggregate query (ADR-0020 §1/§2). StudentAnalyticsService
 * is exported for RecommendationsModule (Sprint 11, ADR-0021) to reuse as a
 * personalization-signal source.
 */
@Module({
  imports: [
    LearningModule,
    AssignmentsModule,
    MentoringModule,
    BullModule.registerQueue({ name: SCHEDULED_REPORT_QUEUE }),
  ],
  controllers: [
    StudentAnalyticsController,
    MentorAnalyticsController,
    AdminAnalyticsController,
    ReportsController,
  ],
  providers: [
    StudentAnalyticsService,
    MentorAnalyticsService,
    AdminPlatformAnalyticsService,
    AdminCommerceAnalyticsService,
    AdminAcademicAnalyticsService,
    AdminEngagementAnalyticsService,
    ReportBuilderService,
    ReportExportService,
    ScheduledReportsService,
    ScheduledReportProcessor,
  ],
  exports: [StudentAnalyticsService],
})
export class AnalyticsModule {}
