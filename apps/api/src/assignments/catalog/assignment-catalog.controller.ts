import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AssignmentDetail, AssignmentSummary, PaginatedData } from "@examora/types";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { toAssignmentDetail, toAssignmentSummary } from "../assignments.mappers";
import { AssignmentCatalogService } from "./assignment-catalog.service";

@ApiTags("assignments: catalog")
@Controller("assignment-catalog")
@RequirePermissions("assignment:read")
export class AssignmentCatalogController {
  constructor(private readonly catalogService: AssignmentCatalogService) {}

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
