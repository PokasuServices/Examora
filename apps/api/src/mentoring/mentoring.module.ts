import { Module } from "@nestjs/common";
import { AssessmentModule } from "../assessment/assessment.module";
import { AssignmentsModule } from "../assignments/assignments.module";
import { LearningModule } from "../learning/learning.module";
import { UsersModule } from "../users/users.module";
import { MentorAssignmentController } from "./assignment/mentor-assignment.controller";
import { MentorAssignmentService } from "./assignment/mentor-assignment.service";
import { MentorFeedbackService } from "./feedback/mentor-feedback.service";
import { MentorMeetingsService } from "./meetings/mentor-meetings.service";
import { MentorDashboardController } from "./mentor-dashboard/mentor-dashboard.controller";
import { MentorDashboardService } from "./mentor-dashboard/mentor-dashboard.service";
import { MentorProfilesController } from "./mentor-profiles/mentor-profiles.controller";
import { MentorProfilesService } from "./mentor-profiles/mentor-profiles.service";
import { MentorWorkflowController } from "./mentor-workflow.controller";
import { MentorNotesService } from "./notes/mentor-notes.service";
import { Student360Controller } from "./student-360/student-360.controller";
import { Student360Service } from "./student-360/student-360.service";
import { MentorTasksService } from "./tasks/mentor-tasks.service";

/**
 * Sprint 6 Mentor Management (FR-MENTOR-01/02/03, ADR-0016): mentor profile
 * CRUD + workload (admin), history-preserving mentor↔student assignment
 * (admin), Student 360 (a read-only aggregator over Learning/Assessment/
 * Assignment data — hence the cross-module imports below), and the mentor
 * workflow (notes/tasks/feedback/meetings) plus the mentor's own dashboard.
 */
@Module({
  imports: [LearningModule, AssessmentModule, AssignmentsModule, UsersModule],
  // MentorProfilesController's "admin/mentors" and MentorAssignmentController's
  // "admin/mentor-assignments" don't overlap with any other controller's
  // routes, so registration order between them doesn't matter (unlike
  // TD-026's admin/assignments/:id vs admin/assignments/submissions
  // collision) — within MentorProfilesController itself, "dashboard" is
  // still registered before the dynamic ":id" route for the same reason.
  controllers: [
    MentorProfilesController,
    MentorAssignmentController,
    MentorDashboardController,
    Student360Controller,
    MentorWorkflowController,
  ],
  providers: [
    MentorProfilesService,
    MentorAssignmentService,
    MentorDashboardService,
    Student360Service,
    MentorNotesService,
    MentorTasksService,
    MentorFeedbackService,
    MentorMeetingsService,
  ],
})
export class MentoringModule {}
