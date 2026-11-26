import { Module } from "@nestjs/common";
import { NotificationModule } from "../notifications/notification.module";
import { StudentAlertsService } from "./student-alerts.service";
import { StudentDashboardsController } from "./student-dashboards.controller";
import { StudentDashboardsService } from "./student-dashboards.service";

/** Tab overviews (Practice, Discuss, Colleges, Rewards) and pull-based bell alerts for students. */
@Module({
  imports: [NotificationModule],
  controllers: [StudentDashboardsController],
  providers: [StudentDashboardsService, StudentAlertsService],
})
export class StudentDashboardsModule {}
