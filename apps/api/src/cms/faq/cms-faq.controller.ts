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
import type { CmsFaqItemDto, CmsVersionDiffEntry } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toCmsContentVersionDto, toCmsFaqItemDto } from "../cms.mappers";
import { CompareCmsVersionsQueryDto } from "../dto/compare-cms-versions-query.dto";
import { CreateCmsFaqItemDto } from "../dto/create-cms-faq-item.dto";
import { ListCmsContentQueryDto } from "../dto/list-cms-content-query.dto";
import { ScheduleCmsContentDto } from "../dto/schedule-cms-content.dto";
import { TransitionCmsContentDto } from "../dto/transition-cms-content.dto";
import { UpdateCmsFaqItemDto } from "../dto/update-cms-faq-item.dto";
import { CmsFaqService } from "./cms-faq.service";

/** FAQ authoring (ADR-0022 §2). `GET :id` doubles as Preview Mode for admins. */
@ApiTags("cms: faq")
@Controller("admin/cms/faq")
@RequirePermissions("cms:manage")
export class CmsFaqController {
  constructor(
    private readonly faqService: CmsFaqService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a FAQ item (DRAFT)" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateCmsFaqItemDto,
    @Req() req: Request,
  ): Promise<CmsFaqItemDto> {
    const item = await this.faqService.create(actor.id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.faq_item_created",
      entityType: "CmsFaqItem",
      entityId: item.id,
      after: { question: item.question },
      ...requestAuditMeta(req),
    });
    return toCmsFaqItemDto(item);
  }

  @Get()
  @ApiOperation({ summary: "List FAQ items, optionally filtered by status" })
  async list(@Query() query: ListCmsContentQueryDto) {
    const { items, total } = await this.faqService.list(query);
    return { items: items.map(toCmsFaqItemDto), page: query.page, pageSize: query.pageSize, total };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a FAQ item by id (any status — doubles as preview)" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<CmsFaqItemDto> {
    return toCmsFaqItemDto(await this.faqService.findByIdOrThrow(id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit a DRAFT FAQ item" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCmsFaqItemDto,
    @Req() req: Request,
  ): Promise<CmsFaqItemDto> {
    const item = await this.faqService.update(actor.id, id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.faq_item_updated",
      entityType: "CmsFaqItem",
      entityId: id,
      ...requestAuditMeta(req),
    });
    return toCmsFaqItemDto(item);
  }

  @Post(":id/transition")
  @RequirePermissions("cms:publish")
  @ApiOperation({ summary: "Move a FAQ item through Draft/Review/Approval/Publish/Archive" })
  async transition(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TransitionCmsContentDto,
    @Req() req: Request,
  ): Promise<CmsFaqItemDto> {
    const item = await this.faqService.transition(actor.id, id, dto.targetStatus);
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.faq_item_transitioned",
      entityType: "CmsFaqItem",
      entityId: id,
      after: { status: item.status },
      ...requestAuditMeta(req),
    });
    return toCmsFaqItemDto(item);
  }

  @Post(":id/schedule-publish")
  @RequirePermissions("cms:publish")
  @ApiOperation({ summary: "Schedule an APPROVED FAQ item to publish at a future time" })
  async schedulePublish(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ScheduleCmsContentDto,
    @Req() req: Request,
  ): Promise<CmsFaqItemDto> {
    const item = await this.faqService.schedulePublish(actor.id, id, new Date(dto.at));
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.faq_item_publish_scheduled",
      entityType: "CmsFaqItem",
      entityId: id,
      after: { at: dto.at },
      ...requestAuditMeta(req),
    });
    return toCmsFaqItemDto(item);
  }

  @Post(":id/schedule-unpublish")
  @RequirePermissions("cms:publish")
  @ApiOperation({
    summary: "Schedule a PUBLISHED FAQ item to unpublish (archive) at a future time",
  })
  async scheduleUnpublish(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ScheduleCmsContentDto,
    @Req() req: Request,
  ): Promise<CmsFaqItemDto> {
    const item = await this.faqService.scheduleUnpublish(actor.id, id, new Date(dto.at));
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.faq_item_unpublish_scheduled",
      entityType: "CmsFaqItem",
      entityId: id,
      after: { at: dto.at },
      ...requestAuditMeta(req),
    });
    return toCmsFaqItemDto(item);
  }

  @Get(":id/versions")
  @ApiOperation({ summary: "List version history for a FAQ item" })
  async listVersions(@Param("id", ParseUUIDPipe) id: string) {
    const versions = await this.faqService.listVersions(id);
    return versions.map(toCmsContentVersionDto);
  }

  @Get(":id/versions/compare")
  @ApiOperation({ summary: "Field-by-field diff between two versions" })
  async compareVersions(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: CompareCmsVersionsQueryDto,
  ): Promise<CmsVersionDiffEntry[]> {
    return this.faqService.compareVersions(id, query.from, query.to);
  }

  @Post(":id/versions/:versionNumber/restore")
  @ApiOperation({ summary: "Restore a FAQ item to a prior version (recorded as a new version)" })
  async restoreVersion(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("versionNumber") versionNumber: string,
    @Req() req: Request,
  ): Promise<CmsFaqItemDto> {
    const item = await this.faqService.restoreVersion(actor.id, id, Number(versionNumber));
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.faq_item_version_restored",
      entityType: "CmsFaqItem",
      entityId: id,
      after: { restoredFromVersion: Number(versionNumber) },
      ...requestAuditMeta(req),
    });
    return toCmsFaqItemDto(item);
  }
}
