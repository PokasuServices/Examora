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
import type { Module, PaginatedData } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { ChangeStatusDto } from "../courses/dto/change-status.dto";
import { ReorderDto } from "../dto/reorder.dto";
import { toModule } from "../content.mappers";
import { CreateModuleDto } from "./dto/create-module.dto";
import { ListModulesQueryDto } from "./dto/list-modules-query.dto";
import { ModulesService } from "./modules.service";
import { UpdateModuleDto } from "./dto/update-module.dto";
import { ProtectedDelete } from "../../common/decorators/protected-delete.decorator";
import { Scoped } from "../../staff/scoped.decorator";
import { ActorScope, scopeWhere } from "../../staff/scope-where";
import type { StaffScope } from "../../staff/staff-scope.service";
import { ReviewableContent } from "../../mentor-desk/content-review.interceptor";

@ApiTags("content: modules")
@Controller("admin/content/modules")
@Scoped(["module", "params:id"], ["topic", "body:topicId"], ["topic", "query:topicId"])
@RequirePermissions("content:manage")
export class ModulesController {
  constructor(
    private readonly modulesService: ModulesService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a module under a topic" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateModuleDto,
    @Req() req: Request,
  ): Promise<Module> {
    const created = await this.modulesService.create(dto, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.module_created",
      entityType: "Module",
      entityId: created.id,
      after: { topicId: created.topicId, title: created.title, slug: created.slug },
      ...requestAuditMeta(req),
    });
    return toModule(created);
  }

  @Get()
  @ApiOperation({ summary: "List modules in a topic" })
  async list(
    @ActorScope() actorScope: StaffScope | null,
    @Query() query: ListModulesQueryDto,
  ): Promise<PaginatedData<Module>> {
    const { items, total } = await this.modulesService.list({
      scope: scopeWhere.module(actorScope),
      topicId: query.topicId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });
    return { items: items.map(toModule), page: query.page, pageSize: query.pageSize, total };
  }

  @Post("reorder")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Reorder modules by an ordered id list" })
  async reorder(
    @CurrentUser() actor: RequestUser,
    @Body() dto: ReorderDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.modulesService.reorder(dto.orderedIds);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.modules_reordered",
      entityType: "Module",
      after: { orderedIds: dto.orderedIds },
      ...requestAuditMeta(req),
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a module by id" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<Module> {
    return toModule(await this.modulesService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @ReviewableContent("module", "update")
  @ApiOperation({ summary: "Update a module" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateModuleDto,
    @Req() req: Request,
  ): Promise<Module> {
    const before = await this.modulesService.findByIdOrThrow(id);
    const updated = await this.modulesService.update(id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.module_updated",
      entityType: "Module",
      entityId: id,
      before: { title: before.title, slug: before.slug },
      after: { title: updated.title, slug: updated.slug },
      ...requestAuditMeta(req),
    });
    return toModule(updated);
  }

  @Patch(":id/status")
  @RequirePermissions("content:publish")
  @ApiOperation({ summary: "Change module status — content:publish" })
  async changeStatus(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @Req() req: Request,
  ): Promise<Module> {
    const before = await this.modulesService.findByIdOrThrow(id);
    const updated = await this.modulesService.changeStatus(id, dto.status);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.module_status_changed",
      entityType: "Module",
      entityId: id,
      before: { status: before.status },
      after: { status: updated.status },
      ...requestAuditMeta(req),
    });
    return toModule(updated);
  }

  @Delete(":id")
  @ProtectedDelete("module")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a module" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.modulesService.remove(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.module_deleted",
      entityType: "Module",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
