import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Course, Curriculum, LessonWithProgress, PaginatedData } from "@examora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { toCourse } from "../content/content.mappers";
import type { RequestUser } from "../auth/types/request-user";
import { CatalogService } from "./catalog.service";
import { ListCatalogCoursesQueryDto } from "./dto/list-catalog-courses-query.dto";
import { toCurriculum, toStudentLesson } from "./learning.mappers";

/**
 * Student-facing catalog: browse PUBLISHED courses, read a course's published
 * curriculum, and open a lesson's content. Requires content:read (all roles).
 */
@ApiTags("catalog")
@Controller("catalog")
@RequirePermissions("content:read")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("courses")
  @ApiOperation({ summary: "Browse published courses" })
  async listCourses(@Query() query: ListCatalogCoursesQueryDto): Promise<PaginatedData<Course>> {
    const { items, total } = await this.catalog.listPublishedCourses({
      page: query.page,
      pageSize: query.pageSize,
      categoryId: query.categoryId,
      examType: query.examType,
    });
    return { items: items.map(toCourse), page: query.page, pageSize: query.pageSize, total };
  }

  @Get("courses/:id")
  @ApiOperation({ summary: "Get a published course" })
  async getCourse(@Param("id", ParseUUIDPipe) id: string): Promise<Course> {
    return toCourse(await this.catalog.getPublishedCourseOrThrow(id));
  }

  @Get("courses/:id/curriculum")
  @ApiOperation({ summary: "Get the published curriculum of a course, with the caller's progress" })
  async getCurriculum(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Curriculum> {
    return toCurriculum(await this.catalog.getCurriculum(id, user.id));
  }

  @Get("lessons/:id")
  @ApiOperation({
    summary: "Read a published lesson's content (404 unless the whole chain is published)",
  })
  async getLesson(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<LessonWithProgress> {
    return toStudentLesson(await this.catalog.getLessonForStudent(id, user.id));
  }
}
