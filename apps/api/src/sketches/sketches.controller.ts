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
  Put,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import type {
  SketchCommentView,
  SketchGalleryItem,
  SketchReviewQueueItem,
  SketchView,
} from "@examora/types";
import { Throttle } from "@nestjs/throttler";
import type { RequestUser } from "../auth/types/request-user";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { SketchesService } from "./sketches.service";
import { Scoped } from "../staff/scoped.decorator";
import { ActorScope } from "../staff/scope-where";
import type { StaffScope } from "../staff/staff-scope.service";

export class SketchFileDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: "image/png" })
  @IsString()
  @MaxLength(100)
  mimeType!: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  sizeBytes!: number;
}

export class ConfirmSketchDto extends SketchFileDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  storageKey!: string;
}

export class ScoresDto {
  @ApiProperty({ description: "criterion → 1..5", example: { Perspective: 4 } })
  @IsObject()
  scores!: Record<string, number>;
}

export class PeerRatingDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;
}

export class ExpertReviewDto extends ScoresDto {
  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  marks!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

/** A comment pinned to a spot on a sketch. */
export class SketchCommentDto {
  @ApiProperty({
    minimum: 0,
    maximum: 1,
    description: "Horizontal position, 0 (left) to 1 (right)",
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  x!: number;

  @ApiProperty({ minimum: 0, maximum: 1, description: "Vertical position, 0 (top) to 1 (bottom)" })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  y!: number;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  body!: string;
}

@ApiTags("student: sketches")
@Controller()
@RequirePermissions("quiz:read")
export class SketchesController {
  constructor(private readonly sketches: SketchesService) {}

  @Post("quiz-attempts/:id/questions/:questionId/upload/presign")
  @ApiOperation({ summary: "Presigned upload URL for a sketch answer" })
  presign(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @Body() dto: SketchFileDto,
  ) {
    return this.sketches.presign(user.id, id, questionId, dto);
  }

  @Post("quiz-attempts/:id/questions/:questionId/upload/confirm")
  @ApiOperation({ summary: "Attach the uploaded sketch as the answer (it is virus-scanned)" })
  confirm(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @Body() dto: ConfirmSketchDto,
  ) {
    return this.sketches.confirm(user.id, id, questionId, dto);
  }

  @Get("sketches/mine")
  @ApiOperation({ summary: "My uploaded sketches with self, expert and peer ratings" })
  mine(@CurrentUser() user: RequestUser): Promise<SketchView[]> {
    return this.sketches.mine(user.id);
  }

  @Put("sketches/:answerId/self")
  @ApiOperation({ summary: "Rate my own sketch on each criterion (1–5)" })
  selfRate(
    @CurrentUser() user: RequestUser,
    @Param("answerId", ParseUUIDPipe) answerId: string,
    @Body() dto: ScoresDto,
  ): Promise<SketchView> {
    return this.sketches.selfRate(user.id, answerId, dto.scores);
  }

  @Get("sketches/questions/:questionId/gallery")
  @ApiOperation({ summary: "Other students' sketches (after rating your own)" })
  gallery(
    @CurrentUser() user: RequestUser,
    @Param("questionId", ParseUUIDPipe) questionId: string,
  ): Promise<SketchGalleryItem[]> {
    return this.sketches.gallery(user.id, questionId);
  }

  @Put("sketches/:answerId/peer")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Rate another student's sketch (1–5)" })
  async peer(
    @CurrentUser() user: RequestUser,
    @Param("answerId", ParseUUIDPipe) answerId: string,
    @Body() dto: PeerRatingDto,
  ): Promise<void> {
    await this.sketches.peerRate(user.id, answerId, dto.score);
  }

  @Get("sketches/:answerId/comments")
  @ApiOperation({ summary: "Comments pinned to spots on a sketch" })
  comments(
    @CurrentUser() user: RequestUser,
    @Param("answerId", ParseUUIDPipe) answerId: string,
  ): Promise<SketchCommentView[]> {
    return this.sketches.comments(user, answerId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("sketches/:answerId/comments")
  @ApiOperation({ summary: "Pin a comment to a spot on a sketch" })
  addComment(
    @CurrentUser() user: RequestUser,
    @Param("answerId", ParseUUIDPipe) answerId: string,
    @Body() dto: SketchCommentDto,
  ): Promise<SketchCommentView[]> {
    return this.sketches.addComment(user, answerId, dto);
  }

  @Delete("sketches/comments/:commentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete my pinned comment (staff may delete any)" })
  async deleteComment(
    @CurrentUser() user: RequestUser,
    @Param("commentId", ParseUUIDPipe) commentId: string,
  ): Promise<void> {
    await this.sketches.deleteComment(user, commentId);
  }
}

@ApiTags("admin: sketch review")
@Controller("admin/sketches")
@Scoped(["answer", "params:answerId"])
@RequirePermissions("assignment:review")
export class AdminSketchesController {
  constructor(private readonly sketches: SketchesService) {}

  @Get()
  @ApiOperation({ summary: "Sketches waiting for (or already given) expert marks" })
  list(
    @ActorScope() actorScope: StaffScope | null,
    @Query("status") status?: string,
  ): Promise<SketchReviewQueueItem[]> {
    return this.sketches.queue(
      status === "reviewed" ? "reviewed" : "pending",
      actorScope?.studentIds ?? null,
    );
  }

  @Put(":answerId/review")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Rate a sketch and award marks (updates the test score)" })
  async review(
    @CurrentUser() user: RequestUser,
    @Param("answerId", ParseUUIDPipe) answerId: string,
    @Body() dto: ExpertReviewDto,
  ): Promise<void> {
    await this.sketches.review(user.id, answerId, dto);
  }

  @Get(":answerId/comments")
  @ApiOperation({ summary: "Pinned comments on a sketch (reviewer)" })
  comments(
    @CurrentUser() user: RequestUser,
    @Param("answerId", ParseUUIDPipe) answerId: string,
  ): Promise<SketchCommentView[]> {
    return this.sketches.comments(user, answerId);
  }

  @Post(":answerId/comments")
  @ApiOperation({ summary: "Pin a comment to a spot on a sketch (reviewer)" })
  addComment(
    @CurrentUser() user: RequestUser,
    @Param("answerId", ParseUUIDPipe) answerId: string,
    @Body() dto: SketchCommentDto,
  ): Promise<SketchCommentView[]> {
    return this.sketches.addComment(user, answerId, dto);
  }

  @Delete("comments/:commentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a pinned comment (reviewer)" })
  async deleteComment(
    @CurrentUser() user: RequestUser,
    @Param("commentId", ParseUUIDPipe) commentId: string,
  ): Promise<void> {
    await this.sketches.deleteComment(user, commentId);
  }
}
