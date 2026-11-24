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
  Put,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import type {
  SketchChallenge,
  SketchCommentView,
  SketchCommunityPage,
  SketchRatingResult,
  SketchReportView,
  SketchRevisionQueueItem,
  SketchRubricView,
  SketchWorkView,
  SketchWorkspace,
} from "@examora/types";
import type { RequestUser } from "../auth/types/request-user";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { ScoresDto, SketchCommentDto, SketchFileDto } from "./sketches.controller";
import { SketchWorksService } from "./sketch-works.service";

export class ConfirmVersionDto extends SketchFileDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  storageKey!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @IsOptional()
  @ValidateIf((o: ConfirmVersionDto) => o.description !== null)
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}

export class DescriptionDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @ValidateIf((o: DescriptionDto) => o.description !== null)
  @IsString()
  @MaxLength(1000)
  description!: string | null;
}

export class WorkCommentDto {
  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;
}

export class ReportSketchDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class RubricFactorDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MaxLength(80)
  title!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 300 })
  @IsOptional()
  @ValidateIf((o: RubricFactorDto) => o.description !== null)
  @IsString()
  @MaxLength(300)
  description?: string | null;
}

export class RubricDto {
  @ApiProperty({ maxLength: 80, example: "Observation drawing" })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title!: string;

  @ApiProperty({ type: [RubricFactorDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => RubricFactorDto)
  factors!: RubricFactorDto[];
}

export class UpdateRubricDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ type: [RubricFactorDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => RubricFactorDto)
  factors?: RubricFactorDto[];
}

export class PeerFeedbackDto {
  @ApiProperty({ type: [String], description: "Factors you liked (from the question's list)" })
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  likedFactors!: string[];

  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @IsOptional()
  @ValidateIf((o: PeerFeedbackDto) => o.comment !== null)
  @IsString()
  @MaxLength(1000)
  comment?: string | null;
}

export class ExpertRatingDto extends ScoresDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 1000 })
  @IsOptional()
  @ValidateIf((o: ExpertRatingDto) => o.comment !== null)
  @IsString()
  @MaxLength(1000)
  comment?: string | null;
}

export class CommunityQueryDto {
  @ApiPropertyOptional({ enum: ["newest", "claps", "top"] })
  @IsOptional()
  @IsIn(["newest", "claps", "top"])
  sort?: "newest" | "claps" | "top";

  @ApiPropertyOptional({ enum: ["all", "unrated", "rated"] })
  @IsOptional()
  @IsIn(["all", "unrated", "rated"])
  filter?: "all" | "unrated" | "rated";

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number;
}

export class ReportStatusDto {
  @ApiProperty({ enum: ["OPEN", "RESOLVED"] })
  @IsIn(["OPEN", "RESOLVED"])
  status!: "OPEN" | "RESOLVED";
}

@ApiTags("student: sketch workspace")
@Controller("sketch-works")
@RequirePermissions("quiz:read")
export class SketchWorksController {
  constructor(private readonly works: SketchWorksService) {}

  @Get("tests/:quizId")
  @ApiOperation({ summary: "A test's sketch questions with my work (test upload + revisions)" })
  workspace(
    @CurrentUser() user: RequestUser,
    @Param("quizId", ParseUUIDPipe) quizId: string,
  ): Promise<SketchWorkspace> {
    return this.works.workspaceForTest(user, quizId);
  }

  @Get("challenges")
  @ApiOperation({ summary: "Sketch questions I can practise, with community size and my work" })
  challenges(@CurrentUser() user: RequestUser): Promise<SketchChallenge[]> {
    return this.works.challenges(user);
  }

  @Get("questions/:questionId/community")
  @ApiOperation({ summary: "Classmates' sketches for a question (after rating your own)" })
  community(
    @CurrentUser() user: RequestUser,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @Query() query: CommunityQueryDto,
  ): Promise<SketchCommunityPage> {
    return this.works.community(user, questionId, {
      sort: query.sort ?? "newest",
      filter: query.filter ?? "all",
      page: query.page ?? 1,
    });
  }

  @Put("versions/:versionId/self")
  @ApiOperation({ summary: "Rate my own version 1–5 per factor (once, +10 XP)" })
  rateSelf(
    @CurrentUser() user: RequestUser,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @Body() dto: ScoresDto,
  ): Promise<SketchRatingResult> {
    return this.works.rateSelf(user.id, versionId, dto.scores);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("versions/:versionId/feedback")
  @ApiOperation({ summary: "Give feedback on a classmate's version (+25 XP, 10 a day)" })
  feedback(
    @CurrentUser() user: RequestUser,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @Body() dto: PeerFeedbackDto,
  ): Promise<SketchRatingResult> {
    return this.works.peerFeedback(user, versionId, dto);
  }

  @Get(":workId")
  @ApiOperation({ summary: "One sketch work (own, or another student's once allowed)" })
  work(
    @CurrentUser() user: RequestUser,
    @Param("workId", ParseUUIDPipe) workId: string,
  ): Promise<SketchWorkView> {
    return this.works.getWork(user, workId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("questions/:questionId/versions/presign")
  @ApiOperation({
    summary: "Upload URL for a revised sketch (max 4 uploads incl. the test upload)",
  })
  presign(
    @CurrentUser() user: RequestUser,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @Body() dto: SketchFileDto,
  ) {
    return this.works.presignVersion(user.id, questionId, dto);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("questions/:questionId/versions")
  @ApiOperation({ summary: "Save an uploaded revision" })
  confirm(
    @CurrentUser() user: RequestUser,
    @Param("questionId", ParseUUIDPipe) questionId: string,
    @Body() dto: ConfirmVersionDto,
  ): Promise<SketchWorkView> {
    return this.works.confirmVersion(user.id, questionId, dto);
  }

  @Patch("versions/:versionId")
  @ApiOperation({ summary: "Edit the description of my sketch version" })
  describe(
    @CurrentUser() user: RequestUser,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @Body() dto: DescriptionDto,
  ): Promise<SketchWorkView> {
    return this.works.updateDescription(user.id, versionId, dto.description);
  }

  @Delete("versions/:versionId")
  @ApiOperation({ summary: "Delete one of my revisions (the test upload stays)" })
  deleteVersion(
    @CurrentUser() user: RequestUser,
    @Param("versionId", ParseUUIDPipe) versionId: string,
  ): Promise<SketchWorkView> {
    return this.works.deleteVersion(user.id, versionId);
  }

  @Get("versions/:versionId/pins")
  @ApiOperation({ summary: "Comments pinned to spots on a sketch version" })
  pins(
    @CurrentUser() user: RequestUser,
    @Param("versionId", ParseUUIDPipe) versionId: string,
  ): Promise<SketchCommentView[]> {
    return this.works.pins(user, versionId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("versions/:versionId/pins")
  @ApiOperation({ summary: "Pin a comment to a spot on a sketch version" })
  addPin(
    @CurrentUser() user: RequestUser,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @Body() dto: SketchCommentDto,
  ): Promise<SketchCommentView[]> {
    return this.works.addPin(user, versionId, dto);
  }

  @Put(":workId/clap")
  @ApiOperation({ summary: "Clap (or un-clap) for another student's sketch" })
  clap(
    @CurrentUser() user: RequestUser,
    @Param("workId", ParseUUIDPipe) workId: string,
  ): Promise<{ clapped: boolean; claps: number }> {
    return this.works.toggleClap(user, workId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(":workId/comments")
  @ApiOperation({ summary: "Comment on a sketch" })
  comment(
    @CurrentUser() user: RequestUser,
    @Param("workId", ParseUUIDPipe) workId: string,
    @Body() dto: WorkCommentDto,
  ): Promise<SketchWorkView> {
    return this.works.addComment(user, workId, dto.body);
  }

  @Delete("comments/:commentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete my comment (staff may delete any)" })
  async deleteComment(
    @CurrentUser() user: RequestUser,
    @Param("commentId", ParseUUIDPipe) commentId: string,
  ): Promise<void> {
    await this.works.deleteComment(user, commentId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(":workId/report")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Report another student's sketch as inappropriate" })
  async report(
    @CurrentUser() user: RequestUser,
    @Param("workId", ParseUUIDPipe) workId: string,
    @Body() dto: ReportSketchDto,
  ): Promise<void> {
    await this.works.report(user, workId, dto.reason);
  }
}

@ApiTags("admin: sketch rating sets & reports")
@Controller("admin/sketch-works")
@RequirePermissions("assignment:review")
export class AdminSketchWorksController {
  constructor(private readonly works: SketchWorksService) {}

  @Get("rubrics")
  @ApiOperation({ summary: "Named rating-factor sets for sketch questions" })
  rubrics(): Promise<SketchRubricView[]> {
    return this.works.rubrics();
  }

  @Post("rubrics")
  @ApiOperation({ summary: "Create a rating-factor set" })
  async createRubric(@Body() dto: RubricDto): Promise<SketchRubricView[]> {
    await this.works.createRubric(dto);
    return this.works.rubrics();
  }

  @Patch("rubrics/:id")
  @ApiOperation({ summary: "Edit a rating-factor set" })
  async updateRubric(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRubricDto,
  ): Promise<SketchRubricView[]> {
    await this.works.updateRubric(id, dto);
    return this.works.rubrics();
  }

  @Delete("rubrics/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a rating-factor set (questions fall back to their criteria)" })
  async deleteRubric(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.works.deleteRubric(id);
  }

  @Get("revisions")
  @ApiOperation({ summary: "Revisions waiting for (or with) reviewer feedback" })
  revisions(
    @CurrentUser() user: RequestUser,
    @Query("status") status?: string,
  ): Promise<SketchRevisionQueueItem[]> {
    return this.works.revisionQueue(user, status === "reviewed" ? "reviewed" : "pending");
  }

  @Put("versions/:versionId/expert")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Reviewer feedback on a revision, 1–5 per factor" })
  async expertRate(
    @CurrentUser() user: RequestUser,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @Body() dto: ExpertRatingDto,
  ): Promise<void> {
    await this.works.expertRate(user, versionId, dto);
  }

  @Get("reports")
  @ApiOperation({ summary: "Sketches reported by students" })
  reports(@Query("status") status?: string): Promise<SketchReportView[]> {
    return this.works.reports(status === "RESOLVED" ? "RESOLVED" : "OPEN");
  }

  @Patch("reports/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Resolve or reopen a sketch report" })
  async setReport(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReportStatusDto,
  ): Promise<void> {
    await this.works.setReportStatus(id, dto.status);
  }
}
