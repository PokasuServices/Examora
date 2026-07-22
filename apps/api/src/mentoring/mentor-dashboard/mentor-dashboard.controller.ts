import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AssignedStudentSummary, MentorDashboard } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/types/request-user";
import { MentorDashboardService } from "./mentor-dashboard.service";

@ApiTags("mentoring: mentor dashboard")
@Controller("mentor")
@RequirePermissions("mentor:workflow")
export class MentorDashboardController {
  constructor(private readonly mentorDashboardService: MentorDashboardService) {}

  @Get("dashboard")
  @ApiOperation({
    summary: "The current mentor's own dashboard — caseload, workload, near-term work",
  })
  async getDashboard(@CurrentUser() actor: RequestUser): Promise<MentorDashboard> {
    return this.mentorDashboardService.getDashboard(actor.id);
  }

  @Get("students")
  @ApiOperation({ summary: "The current mentor's assigned students" })
  async listStudents(@CurrentUser() actor: RequestUser): Promise<AssignedStudentSummary[]> {
    return this.mentorDashboardService.listAssignedStudents(actor.id);
  }
}
