import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { NotificationTemplateDto, PaginatedData } from "@examora/types";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { CreateTemplateDto } from "../dto/create-template.dto";
import { UpdateTemplateDto } from "../dto/update-template.dto";
import { toTemplateDto } from "../notification.mappers";
import { NotificationTemplatesService } from "../notification-templates.service";

/** Admin CRUD for reusable notification content (COMM-MERGED §4, ADR-0019). */
@ApiTags("notifications (admin)")
@Controller("admin/notifications/templates")
@RequirePermissions("notification:manage")
export class NotificationTemplatesAdminController {
  constructor(private readonly templatesService: NotificationTemplatesService) {}

  @Post()
  @ApiOperation({ summary: "Create a notification template" })
  async create(@Body() dto: CreateTemplateDto): Promise<NotificationTemplateDto> {
    return toTemplateDto(await this.templatesService.create(dto));
  }

  @Get()
  @ApiOperation({ summary: "List notification templates" })
  async list(@Query() query: PaginationQueryDto): Promise<PaginatedData<NotificationTemplateDto>> {
    const { items, total } = await this.templatesService.list({
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items: items.map(toTemplateDto), page: query.page, pageSize: query.pageSize, total };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a notification template by id" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<NotificationTemplateDto> {
    return toTemplateDto(await this.templatesService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a notification template" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ): Promise<NotificationTemplateDto> {
    return toTemplateDto(await this.templatesService.update(id, dto));
  }
}
