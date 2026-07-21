import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { AssignmentTemplate, PaginatedData } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { toAssignmentTemplate } from "../assignments.mappers";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { UpdateTemplateDto } from "./dto/update-template.dto";
import { TemplatesService } from "./templates.service";

@ApiTags("assignments: templates")
@Controller("admin/assignments/templates")
@RequirePermissions("assignment:manage")
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create an assignment template" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateTemplateDto,
    @Req() req: Request,
  ): Promise<AssignmentTemplate> {
    const template = await this.templatesService.create(dto, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "assignments.template_created",
      entityType: "AssignmentTemplate",
      entityId: template.id,
      after: { title: template.title },
      ...requestAuditMeta(req),
    });
    return toAssignmentTemplate(template);
  }

  @Get()
  @ApiOperation({ summary: "List assignment templates" })
  async list(@Query() query: PaginationQueryDto): Promise<PaginatedData<AssignmentTemplate>> {
    const { items, total } = await this.templatesService.list({
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      items: items.map(toAssignmentTemplate),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a template by id" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<AssignmentTemplate> {
    return toAssignmentTemplate(await this.templatesService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a template" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
    @Req() req: Request,
  ): Promise<AssignmentTemplate> {
    const updated = await this.templatesService.update(id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "assignments.template_updated",
      entityType: "AssignmentTemplate",
      entityId: id,
      after: { title: updated.title },
      ...requestAuditMeta(req),
    });
    return toAssignmentTemplate(updated);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a template" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.templatesService.remove(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "assignments.template_deleted",
      entityType: "AssignmentTemplate",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
