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
import {
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  PartialType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type {
  CheckpointView,
  CohortView,
  GoalView,
  ProfileActivityItem,
  ProfileOverview,
  ProfilePerformancePoint,
  RevisionItem,
} from "@examora/types";
import type { RequestUser } from "../auth/types/request-user";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { StudentProfileService } from "./student-profile.service";
import { ProtectedDelete } from "../common/decorators/protected-delete.decorator";
import { Scoped } from "../staff/scoped.decorator";
import { ActorScope, scopeWhere } from "../staff/scope-where";
import type { StaffScope } from "../staff/staff-scope.service";

export class GoalDto {
  @ApiProperty()
  @IsUUID("4")
  courseId!: string;

  @ApiProperty({ minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  targetPercent!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class DoneDto {
  @ApiProperty()
  @IsBoolean()
  done!: boolean;
}

export class CheckpointDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ nullable: true, example: "2027-01-15" })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}

export class BatchSlotDto {
  @ApiProperty({ description: "0 = Sunday … 6 = Saturday" })
  @IsInt()
  @Min(0)
  @Max(6)
  day!: number;

  @ApiProperty({ example: "18:00" })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Use a 24-hour time like 18:00" })
  start!: string;

  @ApiProperty({ example: "19:30" })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Use a 24-hour time like 19:30" })
  end!: string;
}

export class CohortDto {
  @ApiProperty({ example: "2026 NID UCEED – Evening" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: "Evening" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  batch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4")
  courseId?: string | null;

  @ApiPropertyOptional({ enum: ["OFFLINE", "ONLINE", "HYBRID"] })
  @IsOptional()
  @IsIn(["OFFLINE", "ONLINE", "HYBRID"])
  mode?: "OFFLINE" | "ONLINE" | "HYBRID";

  @ApiPropertyOptional({ type: [BatchSlotDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(21)
  @ValidateNested({ each: true })
  @Type(() => BatchSlotDto)
  schedule?: BatchSlotDto[];

  @ApiPropertyOptional({ example: "2026-12-01" })
  @IsOptional()
  @IsDateString({ strict: true })
  startsOn?: string | null;

  @ApiPropertyOptional({ example: "2027-05-31" })
  @IsOptional()
  @IsDateString({ strict: true })
  endsOn?: string | null;

  @ApiPropertyOptional({ example: "Room 2, Pune centre" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @ApiPropertyOptional({ example: "https://meet.example.com/abc" })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["https", "http"] })
  @MaxLength(500)
  meetingUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCohortDto extends PartialType(CohortDto) {}

export class CohortMentorsDto {
  @ApiPropertyOptional({ description: "The batch mentor (one per batch); null = none" })
  @IsOptional()
  @IsUUID("4")
  mentorId!: string | null;

  @ApiPropertyOptional({ description: "Temporary cover mentor" })
  @IsOptional()
  @IsUUID("4")
  coverId?: string | null;

  @ApiPropertyOptional({ description: "Last day of cover (YYYY-MM-DD)" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Use a date like 2026-12-31" })
  coverEndsOn?: string | null;
}

export class CohortMembersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @MaxLength(254, { each: true })
  emails!: string[];
}

@ApiTags("student: profile")
@Controller("me")
@RequirePermissions("profile:read:own")
export class StudentProfileController {
  constructor(private readonly profile: StudentProfileService) {}

  @Get("profile")
  @ApiOperation({ summary: "Profile overview: courses, XP, cohorts, mentor comments" })
  overview(@CurrentUser() user: RequestUser): Promise<ProfileOverview> {
    return this.profile.overview(user.id);
  }

  @Get("activity")
  @ApiOperation({ summary: "Recent activity timeline" })
  activity(@CurrentUser() user: RequestUser): Promise<ProfileActivityItem[]> {
    return this.profile.activity(user.id);
  }

  @Get("performance")
  @ApiOperation({ summary: "First-attempt test scores in a course, split by answer method" })
  performance(
    @CurrentUser() user: RequestUser,
    @Query("courseId", ParseUUIDPipe) courseId: string,
    @Query("categoryId") categoryId?: string,
  ): Promise<ProfilePerformancePoint[]> {
    return this.profile.performance(user.id, courseId, categoryId || undefined);
  }

  @Get("revision")
  @ApiOperation({ summary: "Flagged questions and weak topics to revise" })
  revision(@CurrentUser() user: RequestUser): Promise<RevisionItem[]> {
    return this.profile.revision(user.id);
  }

  @Get("goals")
  @ApiOperation({ summary: "Target score per course vs. recent results" })
  goals(@CurrentUser() user: RequestUser): Promise<GoalView[]> {
    return this.profile.goals(user.id);
  }

  @Put("goals")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Set my target score for a course" })
  async setGoal(@CurrentUser() user: RequestUser, @Body() dto: GoalDto): Promise<void> {
    await this.profile.setGoal(user.id, dto.courseId, dto.targetPercent, dto.note);
  }

  @Get("checkpoints")
  @ApiOperation({ summary: "Course checkpoints and which I've completed" })
  checkpoints(@CurrentUser() user: RequestUser): Promise<CheckpointView[]> {
    return this.profile.checkpoints(user.id);
  }

  @Put("checkpoints/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Tick / untick a checkpoint" })
  async setCheckpoint(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DoneDto,
  ): Promise<void> {
    await this.profile.setCheckpoint(user.id, id, dto.done);
  }
}

@ApiTags("admin: checkpoints")
@Controller("admin/content/courses/:courseId/checkpoints")
@Scoped(["course", "params:courseId"])
@RequirePermissions("content:manage")
export class AdminCheckpointsController {
  constructor(private readonly profile: StudentProfileService) {}

  @Get()
  async list(@Param("courseId", ParseUUIDPipe) courseId: string) {
    const rows = await this.profile.listCourseCheckpoints(courseId);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
      completedBy: r._count.completions,
    }));
  }

  @Post()
  @RequirePermissions("practice:manage")
  create(@Param("courseId", ParseUUIDPipe) courseId: string, @Body() dto: CheckpointDto) {
    return this.profile.createCheckpoint(courseId, dto.title, dto.dueDate);
  }

  @Delete(":id")
  @RequirePermissions("practice:manage")
  @ProtectedDelete("checkpoint")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.profile.deleteCheckpoint(id);
  }
}

@ApiTags("admin: cohorts")
@Controller("admin/cohorts")
@Scoped(["cohort", "params:id"])
@RequirePermissions("batches:read")
export class AdminCohortsController {
  constructor(private readonly profile: StudentProfileService) {}

  @Get()
  list(@ActorScope() actorScope: StaffScope | null): Promise<CohortView[]> {
    return this.profile.listCohorts(scopeWhere.cohort(actorScope));
  }

  @Post()
  @RequirePermissions("batches:manage")
  @ApiOperation({ summary: "Create a batch (course, timetable, dates, place or link)" })
  create(@Body() dto: CohortDto): Promise<CohortView> {
    return this.profile.createCohort(dto);
  }

  @Patch(":id")
  @RequirePermissions("batches:manage")
  @ApiOperation({ summary: "Update a batch" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCohortDto,
  ): Promise<CohortView> {
    return this.profile.updateCohort(id, dto);
  }

  @Put(":id/mentors")
  @RequirePermissions("batches:manage")
  @ApiOperation({ summary: "Set a batch's mentors" })
  setMentors(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CohortMentorsDto,
  ): Promise<CohortView> {
    return this.profile.setCohortMentors(id, {
      mentorId: dto.mentorId ?? null,
      coverId: dto.coverId ?? null,
      coverEndsOn: dto.coverEndsOn ?? null,
    });
  }

  @Delete(":id")
  @RequirePermissions("batches:manage")
  @ProtectedDelete("batch")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.profile.deleteCohort(id);
  }

  @Get(":id/members")
  members(@Param("id", ParseUUIDPipe) id: string) {
    return this.profile.cohortMembers(id);
  }

  @Post(":id/members")
  @RequirePermissions("batches:manage")
  @ApiOperation({ summary: "Add students by email" })
  addMembers(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CohortMembersDto) {
    return this.profile.addCohortMembers(id, dto.emails);
  }

  @Delete(":id/members/:userId")
  @RequirePermissions("batches:manage")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("userId", ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.profile.removeCohortMember(id, userId);
  }
}
