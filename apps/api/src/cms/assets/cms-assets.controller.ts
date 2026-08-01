import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { CmsAssetDto } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { toCmsAssetDto } from "../cms.mappers";
import { ConfirmAssetUploadDto } from "../dto/confirm-asset-upload.dto";
import { PresignAssetUploadDto } from "../dto/presign-asset-upload.dto";
import { CmsAssetsService } from "./cms-assets.service";

/** Media Library / Asset Management (ADR-0022 §5), reusing Sprint 5's presigned-upload + malware-scan primitives. */
@ApiTags("cms: assets")
@Controller("admin/cms/assets")
@RequirePermissions("cms:manage")
export class CmsAssetsController {
  constructor(
    private readonly assetsService: CmsAssetsService,
    private readonly auditService: AuditService,
  ) {}

  @Post("presign")
  @ApiOperation({ summary: "Get a presigned upload URL for a media asset" })
  async presign(@Body() dto: PresignAssetUploadDto) {
    return this.assetsService.createPresignedUpload(dto);
  }

  @Post("confirm")
  @ApiOperation({ summary: "Confirm an uploaded asset and queue the malware scan" })
  async confirm(
    @CurrentUser() actor: RequestUser,
    @Body() dto: ConfirmAssetUploadDto,
    @Req() req: Request,
  ): Promise<CmsAssetDto> {
    const asset = await this.assetsService.confirmUpload(actor.id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.asset_uploaded",
      entityType: "CmsAsset",
      entityId: asset.id,
      after: { fileName: asset.fileName },
      ...requestAuditMeta(req),
    });
    return toCmsAssetDto(await this.assetsService.findByIdOrThrow(asset.id));
  }

  @Get()
  @ApiOperation({ summary: "List media library assets" })
  async list(@Query() query: PaginationQueryDto) {
    const { items, total } = await this.assetsService.list(query);
    return { items: items.map(toCmsAssetDto), page: query.page, pageSize: query.pageSize, total };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an asset by id" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<CmsAssetDto> {
    return toCmsAssetDto(await this.assetsService.findByIdOrThrow(id));
  }

  @Get(":id/download-url")
  @ApiOperation({ summary: "Get a presigned download URL for a clean asset" })
  async getDownloadUrl(@Param("id", ParseUUIDPipe) id: string): Promise<{ url: string }> {
    return { url: await this.assetsService.getDownloadUrl(id) };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an asset (only if unreferenced by any content)" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.assetsService.remove(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "cms.asset_deleted",
      entityType: "CmsAsset",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
