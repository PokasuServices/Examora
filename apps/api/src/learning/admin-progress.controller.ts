import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AdminCourseProgress, PaginatedData } from "@examora/types";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { PrismaService } from "../prisma/prisma.service";
import { AdminProgressService } from "./admin-progress.service";

/** Read-only aggregate progress dashboard for administrators (progress:read). */
@ApiTags("admin")
@Controller("admin/progress")
@RequirePermissions("progress:read")
export class AdminProgressController {
  constructor(
    private readonly adminProgress: AdminProgressService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("courses")
  @ApiOperation({ summary: "Per-course learner and completion aggregates" })
  async listCourses(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedData<AdminCourseProgress>> {
    const { items, total } = await this.adminProgress.listCourseProgress({
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items, page: query.page, pageSize: query.pageSize, total };
  }

  @Get("courses/:id")
  @ApiOperation({ summary: "Progress aggregate for one course" })
  async getCourse(@Param("id", ParseUUIDPipe) id: string): Promise<AdminCourseProgress> {
    const course = await this.prisma.course.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, title: true },
    });
    if (!course) {
      throw new NotFoundException("Course not found");
    }
    return this.adminProgress.getCourseProgress(course.id, course.title);
  }
}
