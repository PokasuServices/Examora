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
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
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

export class CohortDto {
  @ApiProperty({ example: "2026 NID UCEED – Online" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: "Online" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  batch?: string;
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
  create(@Param("courseId", ParseUUIDPipe) courseId: string, @Body() dto: CheckpointDto) {
    return this.profile.createCheckpoint(courseId, dto.title, dto.dueDate);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.profile.deleteCheckpoint(id);
  }
}

@ApiTags("admin: cohorts")
@Controller("admin/cohorts")
@RequirePermissions("users:manage")
export class AdminCohortsController {
  constructor(private readonly profile: StudentProfileService) {}

  @Get()
  list(): Promise<CohortView[]> {
    return this.profile.listCohorts();
  }

  @Post()
  create(@Body() dto: CohortDto) {
    return this.profile.createCohort(dto.name, dto.batch);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.profile.deleteCohort(id);
  }

  @Get(":id/members")
  members(@Param("id", ParseUUIDPipe) id: string) {
    return this.profile.cohortMembers(id);
  }

  @Post(":id/members")
  @ApiOperation({ summary: "Add students by email" })
  addMembers(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CohortMembersDto) {
    return this.profile.addCohortMembers(id, dto.emails);
  }

  @Delete(":id/members/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("userId", ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.profile.removeCohortMember(id, userId);
  }
}
