import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { PaginatedData, ReviewerQueueItem, ReviewerSubmissionView } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toReviewerQueueItem, toReviewerSubmissionView } from "../assignments.mappers";
import { ListQueueQueryDto } from "./dto/list-queue-query.dto";
import { PublishReviewDto } from "./dto/publish-review.dto";
import { SaveReviewDto } from "./dto/save-review.dto";
import { ReviewerService } from "./reviewer.service";

@ApiTags("assignments: reviewer")
@Controller("reviewer")
@RequirePermissions("assignment:review")
export class ReviewerController {
  constructor(
    private readonly reviewerService: ReviewerService,
    private readonly auditService: AuditService,
  ) {}

  @Get("queue")
  @ApiOperation({ summary: "List submissions assigned to the caller (filter by status)" })
  async queue(
    @CurrentUser() actor: RequestUser,
    @Query() query: ListQueueQueryDto,
  ): Promise<PaginatedData<ReviewerQueueItem>> {
    const { items, total } = await this.reviewerService.listQueue(actor.id, {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });
    return {
      items: items.map(toReviewerQueueItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  @Get("submissions/:id")
  @ApiOperation({ summary: "Get full review context for an assigned submission" })
  async getSubmission(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ReviewerSubmissionView> {
    return toReviewerSubmissionView(
      await this.reviewerService.getSubmissionForReview(id, actor.id),
    );
  }

  @Post("submissions/:id/review")
  @ApiOperation({ summary: "Save rubric scores as a draft review (does not notify the student)" })
  async saveDraft(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaveReviewDto,
  ): Promise<ReviewerSubmissionView> {
    return toReviewerSubmissionView(await this.reviewerService.saveDraft(id, actor.id, dto));
  }

  @Post("submissions/:id/review/publish")
  @ApiOperation({
    summary: "Publish the review — records the decision and closes out the submission",
  })
  async publish(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PublishReviewDto,
    @Req() req: Request,
  ): Promise<ReviewerSubmissionView> {
    const result = await this.reviewerService.publish(id, actor.id, dto.decision);
    await this.auditService.record({
      actorId: actor.id,
      action: "assignments.review_published",
      entityType: "AssignmentReview",
      entityId: result.review?.id,
      after: {
        submissionId: id,
        decision: dto.decision,
        obtainedMarks: result.review?.obtainedMarks,
      },
      ...requestAuditMeta(req),
    });
    return toReviewerSubmissionView(result);
  }
}
