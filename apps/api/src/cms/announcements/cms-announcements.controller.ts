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
import type { CmsAnnouncementDto, CmsVersionDiffEntry } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toCmsAnnouncementDto, toCmsContentVersionDto } from "../cms.mappers";
import { CompareCmsVersionsQueryDto } from "../dto/compare-cms-versions-query.dto";
import { CreateCmsAnnouncementDto } from "../dto/create-cms-announcement.dto";
import { ListCmsContentQueryDto } from "../dto/list-cms-content-query.dto";
import { ScheduleCmsContentDto } from "../dto/schedule-cms-content.dto";
import { TransitionCmsContentDto } from "../dto/transition-cms-content.dto";
import { UpdateCmsAnnouncementDto } from "../dto/update-cms-announcement.dto";
import { CmsAnnouncementsService } from "./cms-announcements.service";

/** Announcements authoring (ADR-0022 §2). `GET :id` doubles as Preview Mode for admins. */
@ApiTags("cms: announcements")
@Controller("admin/cms/announcements")
@RequirePermissions("cms:manage")
export class CmsAnnouncementsController {
  constructor(
    private readonly announcementsService: CmsAnnouncementsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create an announcement (DRAFT)" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateCmsAnnouncementDto,
    @Req() req: Request,
  ): Promise<CmsAnnouncementDto> {
    const item = await this.announcementsService.create(actor.id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.announcement_created",
      entityType: "CmsAnnouncement",
      entityId: item.id,
      after: { title: item.title },
      ...requestAuditMeta(req),
    });
    return toCmsAnnouncementDto(item);
  }

  @Get()
  @ApiOperation({ summary: "List announcements, optionally filtered by status" })
  async list(@Query() query: ListCmsContentQueryDto) {
    const { items, total } = await this.announcementsService.list(query);
    return {
      items: items.map(toCmsAnnouncementDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an announcement by id (any status — doubles as preview)" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<CmsAnnouncementDto> {
    return toCmsAnnouncementDto(await this.announcementsService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit a DRAFT announcement" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCmsAnnouncementDto,
    @Req() req: Request,
  ): Promise<CmsAnnouncementDto> {
    const item = await this.announcementsService.update(actor.id, id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.announcement_updated",
      entityType: "CmsAnnouncement",
      entityId: id,
      ...requestAuditMeta(req),
    });
    return toCmsAnnouncementDto(item);
  }

  @Post(":id/transition")
  @RequirePermissions("cms:publish")
  @ApiOperation({ summary: "Move an announcement through Draft/Review/Approval/Publish/Archive" })
  async transition(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TransitionCmsContentDto,
    @Req() req: Request,
  ): Promise<CmsAnnouncementDto> {
    const item = await this.announcementsService.transition(actor.id, id, dto.targetStatus);
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.announcement_transitioned",
      entityType: "CmsAnnouncement",
      entityId: id,
      after: { status: item.status },
      ...requestAuditMeta(req),
    });
    return toCmsAnnouncementDto(item);
  }

  @Post(":id/schedule-publish")
  @RequirePermissions("cms:publish")
  @ApiOperation({ summary: "Schedule an APPROVED announcement to publish at a future time" })
  async schedulePublish(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ScheduleCmsContentDto,
    @Req() req: Request,
  ): Promise<CmsAnnouncementDto> {
    const item = await this.announcementsService.schedulePublish(actor.id, id, new Date(dto.at));
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.announcement_publish_scheduled",
      entityType: "CmsAnnouncement",
      entityId: id,
      after: { at: dto.at },
      ...requestAuditMeta(req),
    });
    return toCmsAnnouncementDto(item);
  }

  @Post(":id/schedule-unpublish")
  @RequirePermissions("cms:publish")
  @ApiOperation({
    summary: "Schedule a PUBLISHED announcement to unpublish (archive) at a future time",
  })
  async scheduleUnpublish(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ScheduleCmsContentDto,
    @Req() req: Request,
  ): Promise<CmsAnnouncementDto> {
    const item = await this.announcementsService.scheduleUnpublish(actor.id, id, new Date(dto.at));
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.announcement_unpublish_scheduled",
      entityType: "CmsAnnouncement",
      entityId: id,
      after: { at: dto.at },
      ...requestAuditMeta(req),
    });
    return toCmsAnnouncementDto(item);
  }

  @Get(":id/versions")
  @ApiOperation({ summary: "List version history for an announcement" })
  async listVersions(@Param("id", ParseUUIDPipe) id: string) {
    const versions = await this.announcementsService.listVersions(id);
    return versions.map(toCmsContentVersionDto);
  }

  @Get(":id/versions/compare")
  @ApiOperation({ summary: "Field-by-field diff between two versions" })
  async compareVersions(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: CompareCmsVersionsQueryDto,
  ): Promise<CmsVersionDiffEntry[]> {
    return this.announcementsService.compareVersions(id, query.from, query.to);
  }

  @Post(":id/versions/:versionNumber/restore")
  @ApiOperation({
    summary: "Restore an announcement to a prior version (recorded as a new version)",
  })
  async restoreVersion(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("versionNumber") versionNumber: string,
    @Req() req: Request,
  ): Promise<CmsAnnouncementDto> {
    const item = await this.announcementsService.restoreVersion(
      actor.id,
      id,
      Number(versionNumber),
    );
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.announcement_version_restored",
      entityType: "CmsAnnouncement",
      entityId: id,
      after: { restoredFromVersion: Number(versionNumber) },
      ...requestAuditMeta(req),
    });
    return toCmsAnnouncementDto(item);
  }
}
