import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { MentorCourseOption, MentorCourseProgress } from "@examora/types";
import type { RequestUser } from "../../auth/types/request-user";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { MentorCoursesService } from "./mentor-courses.service";

@ApiTags("mentoring: course progress")
@Controller("mentor/courses")
@RequirePermissions("mentor:workflow")
export class MentorCoursesController {
  constructor(private readonly mentorCourses: MentorCoursesService) {}

  @Get()
  @ApiOperation({ summary: "Courses my current students are licensed for" })
  courses(@CurrentUser() actor: RequestUser): Promise<MentorCourseOption[]> {
    return this.mentorCourses.courses(actor.id);
  }

  @Get(":courseId/progress")
  @ApiOperation({ summary: "My students' lessons, tests and assignments in one course" })
  progress(
    @CurrentUser() actor: RequestUser,
    @Param("courseId", ParseUUIDPipe) courseId: string,
  ): Promise<MentorCourseProgress> {
    return this.mentorCourses.progress(actor.id, courseId);
  }
}
