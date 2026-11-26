import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
  AssignmentDetail,
  AssignmentSummary,
  PaginatedData,
  StudentAssignmentDashboard,
} from "@examora/types";
import type { RequestUser } from "../../auth/types/request-user";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { toAssignmentDetail, toAssignmentSummary } from "../assignments.mappers";
import { AssignmentCatalogService } from "./assignment-catalog.service";
import { StudentAssignmentsService } from "./student-assignments.service";

@ApiTags("assignments: catalog")
@Controller("assignment-catalog")
@RequirePermissions("assignment:read")
export class AssignmentCatalogController {
  constructor(
    private readonly catalogService: AssignmentCatalogService,
    private readonly studentAssignments: StudentAssignmentsService,
  ) {}

  @Get("dashboard")
  @ApiOperation({
    summary: "My Assignments overview: states, deadlines, what's new since my last visit",
  })
  dashboard(@CurrentUser() user: RequestUser): Promise<StudentAssignmentDashboard> {
    return this.studentAssignments.dashboard(user.id);
  }

  @Post("dashboard/seen")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Mark Assignments as seen (clears the 'new' flags next time)" })
  async seen(@CurrentUser() user: RequestUser): Promise<void> {
    await this.studentAssignments.markSeen(user.id);
  }

  @Get("assignments")
  @ApiOperation({ summary: "List published assignments" })
  async list(@Query() query: PaginationQueryDto): Promise<PaginatedData<AssignmentSummary>> {
    const { items, total } = await this.catalogService.listPublished({
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      items: items.map(toAssignmentSummary),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  @Get("assignments/:id")
  @ApiOperation({ summary: "Get a published assignment with its rubric criteria" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<AssignmentDetail> {
    return toAssignmentDetail(await this.catalogService.getPublishedOrThrow(id));
  }
}
