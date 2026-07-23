import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Enrollment, PaginatedData } from "@examora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import type { RequestUser } from "../auth/types/request-user";
import { toEnrollment } from "./enrollment.mappers";
import { EnrollmentService } from "./enrollment.service";

/**
 * A student's own enrollments (course entitlements) and purchase history
 * (ADR-0018) — gated by the baseline `commerce:read`, matching the
 * assignment:read/quiz:read/community:read precedent (ADR-0013).
 */
@ApiTags("commerce: enrollment")
@Controller()
@RequirePermissions("commerce:read")
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Get("enrollments")
  @ApiOperation({ summary: "List the caller's enrollments (purchase history)" })
  async listMine(
    @CurrentUser() actor: RequestUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedData<Enrollment>> {
    const { items, total } = await this.enrollmentService.listMine(actor.id, {
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items: items.map(toEnrollment), page: query.page, pageSize: query.pageSize, total };
  }

  @Post("courses/:courseId/enroll")
  @ApiOperation({ summary: "Self-enroll in a free course" })
  async enrollFree(
    @CurrentUser() actor: RequestUser,
    @Param("courseId", ParseUUIDPipe) courseId: string,
  ): Promise<Enrollment> {
    return toEnrollment(await this.enrollmentService.enrollFree(actor.id, courseId));
  }
}
