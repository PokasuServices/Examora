import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { CmsPageDto, CmsVersionDiffEntry } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toCmsContentVersionDto, toCmsPageDto } from "../cms.mappers";
import { CompareCmsVersionsQueryDto } from "../dto/compare-cms-versions-query.dto";
import { CreateCmsPageDto } from "../dto/create-cms-page.dto";
import { ListCmsPagesQueryDto } from "../dto/list-cms-pages-query.dto";
import { ScheduleCmsContentDto } from "../dto/schedule-cms-content.dto";
import { TransitionCmsContentDto } from "../dto/transition-cms-content.dto";
import { UpdateCmsPageDto } from "../dto/update-cms-page.dto";
import { CmsPagesService } from "./cms-pages.service";

/**
 * Landing/Static Pages authoring (ADR-0022 §2). `GET :id` returns full
 * content regardless of workflow status, gated by `cms:manage` rather than
 * public visibility — this doubles as "Preview Mode" for admins without a
 * separate preview-token mechanism.
 */
@ApiTags("cms: pages")
@Controller("admin/cms/pages")
@RequirePermissions("cms:manage")
export class CmsPagesController {
  constructor(
    private readonly pagesService: CmsPagesService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a landing or static page (DRAFT)" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateCmsPageDto,
    @Req() req: Request,
  ): Promise<CmsPageDto> {
    const page = await this.pagesService.create(actor.id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.page_created",
      entityType: "CmsPage",
      entityId: page.id,
      after: { slug: page.slug, pageType: page.pageType },
      ...requestAuditMeta(req),
    });
    return toCmsPageDto(page);
  }

  @Get()
  @ApiOperation({ summary: "List pages, optionally filtered by pageType/status" })
  async list(@Query() query: ListCmsPagesQueryDto) {
    const { items, total } = await this.pagesService.list(query);
    return { items: items.map(toCmsPageDto), page: query.page, pageSize: query.pageSize, total };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a page by id (any status — doubles as preview)" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<CmsPageDto> {
    return toCmsPageDto(await this.pagesService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit a DRAFT page" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCmsPageDto,
    @Req() req: Request,
  ): Promise<CmsPageDto> {
    const page = await this.pagesService.update(actor.id, id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.page_updated",
      entityType: "CmsPage",
      entityId: id,
      ...requestAuditMeta(req),
    });
    return toCmsPageDto(page);
  }

  @Post(":id/transition")
  @RequirePermissions("cms:publish")
  @ApiOperation({ summary: "Move a page through Draft/Review/Approval/Publish/Archive" })
  async transition(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TransitionCmsContentDto,
    @Req() req: Request,
  ): Promise<CmsPageDto> {
    const page = await this.pagesService.transition(actor.id, id, dto.targetStatus);
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.page_transitioned",
      entityType: "CmsPage",
      entityId: id,
      after: { status: page.status },
      ...requestAuditMeta(req),
    });
    return toCmsPageDto(page);
  }

  @Post(":id/schedule-publish")
  @RequirePermissions("cms:publish")
  @ApiOperation({ summary: "Schedule an APPROVED page to publish at a future time" })
  async schedulePublish(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ScheduleCmsContentDto,
    @Req() req: Request,
  ): Promise<CmsPageDto> {
    const page = await this.pagesService.schedulePublish(actor.id, id, new Date(dto.at));
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.page_publish_scheduled",
      entityType: "CmsPage",
      entityId: id,
      after: { at: dto.at },
      ...requestAuditMeta(req),
    });
    return toCmsPageDto(page);
  }

  @Post(":id/schedule-unpublish")
  @RequirePermissions("cms:publish")
  @ApiOperation({ summary: "Schedule a PUBLISHED page to unpublish (archive) at a future time" })
  async scheduleUnpublish(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ScheduleCmsContentDto,
    @Req() req: Request,
  ): Promise<CmsPageDto> {
    const page = await this.pagesService.scheduleUnpublish(actor.id, id, new Date(dto.at));
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.page_unpublish_scheduled",
      entityType: "CmsPage",
      entityId: id,
      after: { at: dto.at },
      ...requestAuditMeta(req),
    });
    return toCmsPageDto(page);
  }

  @Get(":id/versions")
  @ApiOperation({ summary: "List version history for a page" })
  async listVersions(@Param("id", ParseUUIDPipe) id: string) {
    const versions = await this.pagesService.listVersions(id);
    return versions.map(toCmsContentVersionDto);
  }

  @Get(":id/versions/compare")
  @ApiOperation({ summary: "Field-by-field diff between two versions" })
  async compareVersions(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: CompareCmsVersionsQueryDto,
  ): Promise<CmsVersionDiffEntry[]> {
    return this.pagesService.compareVersions(id, query.from, query.to);
  }

  @Post(":id/versions/:versionNumber/restore")
  @ApiOperation({ summary: "Restore a page to a prior version (recorded as a new version)" })
  async restoreVersion(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("versionNumber") versionNumber: string,
    @Req() req: Request,
  ): Promise<CmsPageDto> {
    const page = await this.pagesService.restoreVersion(actor.id, id, Number(versionNumber));
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.page_version_restored",
      entityType: "CmsPage",
      entityId: id,
      after: { restoredFromVersion: Number(versionNumber) },
      ...requestAuditMeta(req),
    });
    return toCmsPageDto(page);
  }
}
