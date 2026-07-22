import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Student360 } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/types/request-user";
import { Student360Service } from "./student-360.service";

@ApiTags("mentoring: student 360")
@Controller("students")
@RequirePermissions("mentor:workflow")
export class Student360Controller {
  constructor(private readonly student360Service: Student360Service) {}

  @Get(":studentId/360")
  @ApiOperation({
    summary:
      "Aggregated student view — profile, learning progress, quiz/assignment history, activity timeline",
  })
  async getStudent360(
    @CurrentUser() actor: RequestUser,
    @Param("studentId", ParseUUIDPipe) studentId: string,
  ): Promise<Student360> {
    return this.student360Service.getStudent360(actor, studentId);
  }
}
