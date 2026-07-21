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
import { ApiOperation, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import type { Request } from "express";
import type {
  AssignmentComment,
  PaginatedData,
  PresignedUpload,
  SubmissionDetail,
  SubmissionFile,
  SubmissionHistoryItem,
} from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import {
  toAssignmentComment,
  toSubmissionDetail,
  toSubmissionFile,
  toSubmissionHistoryItem,
} from "../assignments.mappers";
import { AddCommentDto } from "./dto/add-comment.dto";
import { ConfirmFileDto } from "./dto/confirm-file.dto";
import { PresignFileDto } from "./dto/presign-file.dto";
import { StartSubmissionDto } from "./dto/start-submission.dto";
import { UpdateSubmissionDto } from "./dto/update-submission.dto";
import { SubmissionsService } from "./submissions.service";

class ListHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4")
  assignmentId?: string;
}

@ApiTags("assignments: submissions")
@Controller("assignment-submissions")
@RequirePermissions("assignment:read")
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Start a new submission, or resume/resubmit the latest one" })
  async start(
    @CurrentUser() actor: RequestUser,
    @Body() dto: StartSubmissionDto,
  ): Promise<SubmissionDetail> {
    const submission = await this.submissionsService.start(dto.assignmentId, actor.id);
    return toSubmissionDetail(await this.submissionsService.getDetail(submission.id, actor.id));
  }

  @Get()
  @ApiOperation({
    summary: "List the caller's submission history (optionally filtered by assignment)",
  })
  async history(
    @CurrentUser() actor: RequestUser,
    @Query() query: ListHistoryQueryDto,
  ): Promise<PaginatedData<SubmissionHistoryItem>> {
    const items = await this.submissionsService.listHistory(actor.id, query.assignmentId);
    return {
      items: items.map(toSubmissionHistoryItem),
      page: 1,
      pageSize: items.length,
      total: items.length,
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get full submission detail (owner or the assigned reviewer)" })
  async getDetail(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SubmissionDetail> {
    return toSubmissionDetail(await this.submissionsService.getDetail(id, actor.id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update notes on a DRAFT submission" })
  async updateNotes(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubmissionDto,
  ): Promise<SubmissionDetail> {
    await this.submissionsService.updateNotes(id, actor.id, dto);
    return toSubmissionDetail(await this.submissionsService.getDetail(id, actor.id));
  }

  @Post(":id/files/presign")
  @ApiOperation({
    summary: "Get a presigned upload URL for a new file (validated against file rules)",
  })
  async presignFile(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PresignFileDto,
  ): Promise<PresignedUpload> {
    return this.submissionsService.createPresignedUpload(id, actor.id, dto);
  }

  @Post(":id/files/confirm")
  @ApiOperation({
    summary: "Confirm a completed upload — creates the file record and queues the scan",
  })
  async confirmFile(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ConfirmFileDto,
    @Req() req: Request,
  ): Promise<SubmissionFile> {
    const file = await this.submissionsService.confirmUpload(id, actor.id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "assignments.file_uploaded",
      entityType: "SubmissionFile",
      entityId: file.id,
      after: { submissionId: id, fileName: file.fileName },
      ...requestAuditMeta(req),
    });
    return toSubmissionFile(file);
  }

  @Delete(":id/files/:fileId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove a file from a DRAFT submission" })
  async removeFile(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ): Promise<void> {
    await this.submissionsService.removeFile(id, actor.id, fileId);
  }

  @Get(":id/files/:fileId/download-url")
  @ApiOperation({
    summary: "Get a presigned download URL (only ever resolves once the file is CLEAN)",
  })
  async downloadUrl(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
  ): Promise<{ url: string }> {
    return { url: await this.submissionsService.getDownloadUrl(id, fileId, actor.id) };
  }

  @Post(":id/submit")
  @ApiOperation({ summary: "Finalize a DRAFT submission (locks editing, requires >=1 file)" })
  async submitFinal(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<SubmissionDetail> {
    const submitted = await this.submissionsService.submitFinal(id, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "assignments.submission_submitted",
      entityType: "AssignmentSubmission",
      entityId: submitted.id,
      after: { assignmentId: submitted.assignmentId, version: submitted.version },
      ...requestAuditMeta(req),
    });
    return toSubmissionDetail(await this.submissionsService.getDetail(id, actor.id));
  }

  @Get(":id/comments")
  @ApiOperation({ summary: "List comments on a submission (owner or the assigned reviewer)" })
  async listComments(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<AssignmentComment[]> {
    return (await this.submissionsService.listComments(id, actor.id)).map(toAssignmentComment);
  }

  @Post(":id/comments")
  @ApiOperation({ summary: "Add a comment (owner or the assigned reviewer)" })
  async addComment(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AddCommentDto,
    @Req() req: Request,
  ): Promise<AssignmentComment> {
    const comment = await this.submissionsService.addComment(id, actor.id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "assignments.comment_added",
      entityType: "AssignmentComment",
      entityId: comment.id,
      after: { submissionId: id },
      ...requestAuditMeta(req),
    });
    return toAssignmentComment(comment);
  }
}
