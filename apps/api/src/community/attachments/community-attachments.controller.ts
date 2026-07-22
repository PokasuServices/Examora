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
import type { CommunityAttachment, CommunityTargetType } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toCommunityAttachment } from "../community.mappers";
import { CommunityAttachmentsService } from "./community-attachments.service";
import { ConfirmAttachmentDto } from "./dto/confirm-attachment.dto";
import { PresignAttachmentDto } from "./dto/presign-attachment.dto";

@ApiTags("community: attachments")
@Controller("community/attachments")
@RequirePermissions("community:read")
export class CommunityAttachmentsController {
  constructor(
    private readonly attachmentsService: CommunityAttachmentsService,
    private readonly auditService: AuditService,
  ) {}

  @Post("presign")
  @ApiOperation({ summary: "Get a presigned upload URL for a thread/reply attachment" })
  async presign(@CurrentUser() actor: RequestUser, @Body() dto: PresignAttachmentDto) {
    return this.attachmentsService.createPresignedUpload(actor, dto);
  }

  @Post("confirm")
  @ApiOperation({ summary: "Confirm an uploaded attachment and queue the malware scan" })
  async confirm(
    @CurrentUser() actor: RequestUser,
    @Body() dto: ConfirmAttachmentDto,
    @Req() req: Request,
  ): Promise<CommunityAttachment> {
    const attachment = await this.attachmentsService.confirmUpload(actor, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.attachment_uploaded",
      entityType: "CommunityAttachment",
      entityId: attachment.id,
      after: { fileName: attachment.fileName, targetType: dto.targetType },
      ...requestAuditMeta(req),
    });
    return toCommunityAttachment(attachment);
  }

  @Get()
  @ApiOperation({ summary: "List attachments for a thread or reply" })
  async listForTarget(
    @CurrentUser() actor: RequestUser,
    @Query("targetType") targetType: CommunityTargetType,
    @Query("targetId", ParseUUIDPipe) targetId: string,
  ): Promise<CommunityAttachment[]> {
    const attachments = await this.attachmentsService.listForTarget(actor, targetType, targetId);
    return attachments.map(toCommunityAttachment);
  }

  @Get(":id/download-url")
  @ApiOperation({ summary: "Get a presigned download URL for a clean attachment" })
  async getDownloadUrl(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<{ url: string }> {
    return { url: await this.attachmentsService.getDownloadUrl(actor, id) };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an attachment (owner or moderator)" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.attachmentsService.remove(actor, id);
    await this.auditService.record({
      actorId: actor.id,
      action: "community.attachment_deleted",
      entityType: "CommunityAttachment",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
