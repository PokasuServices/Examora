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
import type { ForumCategory, PaginatedData } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toForumCategory } from "../community.mappers";
import { CreateForumCategoryDto } from "./dto/create-forum-category.dto";
import { ListForumsQueryDto } from "./dto/list-forums-query.dto";
import { UpdateForumCategoryDto } from "./dto/update-forum-category.dto";
import { ForumCategoriesService } from "./forum-categories.service";

/** Admin CRUD for forum categories (ADR-0017, mirrors Sprint 2's CategoriesController). */
@ApiTags("community: forums (admin)")
@Controller("admin/community/categories")
@RequirePermissions("community:manage")
export class ForumCategoriesAdminController {
  constructor(
    private readonly categoriesService: ForumCategoriesService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a forum category (community:manage)" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateForumCategoryDto,
    @Req() req: Request,
  ): Promise<ForumCategory> {
    const category = await this.categoriesService.create(dto, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.category_created",
      entityType: "ForumCategory",
      entityId: category.id,
      after: { title: category.title, slug: category.slug },
      ...requestAuditMeta(req),
    });
    return toForumCategory(category);
  }

  @Get()
  @ApiOperation({ summary: "List forum categories" })
  async list(@Query() query: ListForumsQueryDto): Promise<PaginatedData<ForumCategory>> {
    const { items, total } = await this.categoriesService.list({
      page: query.page,
      pageSize: query.pageSize,
      isActive: query.isActive === undefined ? undefined : query.isActive === "true",
    });
    return { items: items.map(toForumCategory), page: query.page, pageSize: query.pageSize, total };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a forum category by id" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<ForumCategory> {
    return toForumCategory(await this.categoriesService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a forum category" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateForumCategoryDto,
    @Req() req: Request,
  ): Promise<ForumCategory> {
    const before = await this.categoriesService.findByIdOrThrow(id);
    const updated = await this.categoriesService.update(id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.category_updated",
      entityType: "ForumCategory",
      entityId: id,
      before: { title: before.title, isActive: before.isActive },
      after: { title: updated.title, isActive: updated.isActive },
      ...requestAuditMeta(req),
    });
    return toForumCategory(updated);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a forum category" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.categoriesService.remove(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.category_deleted",
      entityType: "ForumCategory",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
