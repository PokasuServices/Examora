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
import type { Category, PaginatedData } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toCategory } from "../content.mappers";
import { ReorderDto } from "../dto/reorder.dto";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { ListCategoriesQueryDto } from "./dto/list-categories-query.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@ApiTags("content: categories")
@Controller("admin/content/categories")
@RequirePermissions("content:manage")
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a category (content:manage)" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateCategoryDto,
    @Req() req: Request,
  ): Promise<Category> {
    const category = await this.categoriesService.create(dto, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.category_created",
      entityType: "Category",
      entityId: category.id,
      after: { name: category.name, slug: category.slug },
      ...requestAuditMeta(req),
    });
    return toCategory(category);
  }

  @Get()
  @ApiOperation({ summary: "List categories" })
  async list(@Query() query: ListCategoriesQueryDto): Promise<PaginatedData<Category>> {
    const { items, total } = await this.categoriesService.list({
      page: query.page,
      pageSize: query.pageSize,
      isActive: query.isActive === undefined ? undefined : query.isActive === "true",
    });
    return {
      items: items.map(toCategory),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  @Post("reorder")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Reorder categories by an ordered id list" })
  async reorder(
    @CurrentUser() actor: RequestUser,
    @Body() dto: ReorderDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.categoriesService.reorder(dto.orderedIds);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.categories_reordered",
      entityType: "Category",
      after: { orderedIds: dto.orderedIds },
      ...requestAuditMeta(req),
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a category by id" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<Category> {
    return toCategory(await this.categoriesService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a category" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: Request,
  ): Promise<Category> {
    const before = await this.categoriesService.findByIdOrThrow(id);
    const updated = await this.categoriesService.update(id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.category_updated",
      entityType: "Category",
      entityId: id,
      before: { name: before.name, slug: before.slug, isActive: before.isActive },
      after: { name: updated.name, slug: updated.slug, isActive: updated.isActive },
      ...requestAuditMeta(req),
    });
    return toCategory(updated);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Soft-delete a category" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.categoriesService.remove(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "content.category_deleted",
      entityType: "Category",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
