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
import type { CmsBannerDto, CmsVersionDiffEntry } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toCmsBannerDto, toCmsContentVersionDto } from "../cms.mappers";
import { CompareCmsVersionsQueryDto } from "../dto/compare-cms-versions-query.dto";
import { CreateCmsBannerDto } from "../dto/create-cms-banner.dto";
import { ListCmsBannersQueryDto } from "../dto/list-cms-banners-query.dto";
import { ScheduleCmsContentDto } from "../dto/schedule-cms-content.dto";
import { TransitionCmsContentDto } from "../dto/transition-cms-content.dto";
import { UpdateCmsBannerDto } from "../dto/update-cms-banner.dto";
import { CmsBannersService } from "./cms-banners.service";

/** Banner management (ADR-0022 §2, §5). `GET :id` doubles as Preview Mode for admins. */
@ApiTags("cms: banners")
@Controller("admin/cms/banners")
@RequirePermissions("cms:manage")
export class CmsBannersController {
  constructor(
    private readonly bannersService: CmsBannersService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a banner (DRAFT)" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateCmsBannerDto,
    @Req() req: Request,
  ): Promise<CmsBannerDto> {
    const item = await this.bannersService.create(actor.id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.banner_created",
      entityType: "CmsBanner",
      entityId: item.id,
      after: { title: item.title, placement: item.placement },
      ...requestAuditMeta(req),
    });
    return toCmsBannerDto(item);
  }

  @Get()
  @ApiOperation({ summary: "List banners, optionally filtered by status/placement" })
  async list(@Query() query: ListCmsBannersQueryDto) {
    const { items, total } = await this.bannersService.list(query);
    return { items: items.map(toCmsBannerDto), page: query.page, pageSize: query.pageSize, total };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a banner by id (any status — doubles as preview)" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<CmsBannerDto> {
    return toCmsBannerDto(await this.bannersService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit a DRAFT banner" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCmsBannerDto,
    @Req() req: Request,
  ): Promise<CmsBannerDto> {
    const item = await this.bannersService.update(actor.id, id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.banner_updated",
      entityType: "CmsBanner",
      entityId: id,
      ...requestAuditMeta(req),
    });
    return toCmsBannerDto(item);
  }

  @Post(":id/transition")
  @RequirePermissions("cms:publish")
  @ApiOperation({ summary: "Move a banner through Draft/Review/Approval/Publish/Archive" })
  async transition(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TransitionCmsContentDto,
    @Req() req: Request,
  ): Promise<CmsBannerDto> {
    const item = await this.bannersService.transition(actor.id, id, dto.targetStatus);
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.banner_transitioned",
      entityType: "CmsBanner",
      entityId: id,
      after: { status: item.status },
      ...requestAuditMeta(req),
    });
    return toCmsBannerDto(item);
  }

  @Post(":id/schedule-publish")
  @RequirePermissions("cms:publish")
  @ApiOperation({ summary: "Schedule an APPROVED banner to publish at a future time" })
  async schedulePublish(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ScheduleCmsContentDto,
    @Req() req: Request,
  ): Promise<CmsBannerDto> {
    const item = await this.bannersService.schedulePublish(actor.id, id, new Date(dto.at));
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.banner_publish_scheduled",
      entityType: "CmsBanner",
      entityId: id,
      after: { at: dto.at },
      ...requestAuditMeta(req),
    });
    return toCmsBannerDto(item);
  }

  @Post(":id/schedule-unpublish")
  @RequirePermissions("cms:publish")
  @ApiOperation({ summary: "Schedule a PUBLISHED banner to unpublish (archive) at a future time" })
  async scheduleUnpublish(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ScheduleCmsContentDto,
    @Req() req: Request,
  ): Promise<CmsBannerDto> {
    const item = await this.bannersService.scheduleUnpublish(actor.id, id, new Date(dto.at));
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.banner_unpublish_scheduled",
      entityType: "CmsBanner",
      entityId: id,
      after: { at: dto.at },
      ...requestAuditMeta(req),
    });
    return toCmsBannerDto(item);
  }

  @Get(":id/versions")
  @ApiOperation({ summary: "List version history for a banner" })
  async listVersions(@Param("id", ParseUUIDPipe) id: string) {
    const versions = await this.bannersService.listVersions(id);
    return versions.map(toCmsContentVersionDto);
  }

  @Get(":id/versions/compare")
  @ApiOperation({ summary: "Field-by-field diff between two versions" })
  async compareVersions(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: CompareCmsVersionsQueryDto,
  ): Promise<CmsVersionDiffEntry[]> {
    return this.bannersService.compareVersions(id, query.from, query.to);
  }

  @Post(":id/versions/:versionNumber/restore")
  @ApiOperation({ summary: "Restore a banner to a prior version (recorded as a new version)" })
  async restoreVersion(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("versionNumber") versionNumber: string,
    @Req() req: Request,
  ): Promise<CmsBannerDto> {
    const item = await this.bannersService.restoreVersion(actor.id, id, Number(versionNumber));
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.banner_version_restored",
      entityType: "CmsBanner",
      entityId: id,
      after: { restoredFromVersion: Number(versionNumber) },
      ...requestAuditMeta(req),
    });
    return toCmsBannerDto(item);
  }
}
