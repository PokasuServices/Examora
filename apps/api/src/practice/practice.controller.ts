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
} from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import type {
  PracticeOverview,
  PracticeTestDetail,
  TestShareInfo,
  TestShareVisitResult,
} from "@examora/types";
import type { RequestUser } from "../auth/types/request-user";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PracticeService } from "./practice.service";
import { assertShareCode, TestSharesService } from "./test-shares.service";

export class StudiedDto {
  @ApiProperty()
  @IsBoolean()
  studied!: boolean;
}

export class PracticeCategoryDto {
  @ApiProperty({ example: "Mock tests" })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class UpdatePracticeCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

@ApiTags("student: practice")
@Controller("practice")
@RequirePermissions("quiz:read")
export class PracticeController {
  constructor(
    private readonly practice: PracticeService,
    private readonly shares: TestSharesService,
  ) {}

  @Get("tests/:id/share")
  @ApiOperation({ summary: "My share link for a test and the XP it has earned" })
  share(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<TestShareInfo> {
    return this.shares.get(user.id, id);
  }

  @Post("tests/:id/share")
  @ApiOperation({ summary: "Create (or return) my share link for a test" })
  createShare(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<TestShareInfo> {
    return this.shares.create(user.id, id);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("shares/:code/visit")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Record that I opened someone's share link (rewards the sharer once)" })
  visitShare(
    @CurrentUser() user: RequestUser,
    @Param("code") code: string,
  ): Promise<TestShareVisitResult> {
    return this.shares.visit(user.id, assertShareCode(code));
  }

  @Get("courses/:courseId")
  @ApiOperation({ summary: "Practice categories and tests for a course, plus weak topics" })
  overview(
    @CurrentUser() user: RequestUser,
    @Param("courseId", ParseUUIDPipe) courseId: string,
  ): Promise<PracticeOverview> {
    return this.practice.overview(user.id, courseId);
  }

  @Get("tests/:id")
  @ApiOperation({ summary: "A practice test's details and the caller's attempts" })
  test(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<PracticeTestDetail> {
    return this.practice.testDetail(user.id, id);
  }

  @Put("topics/:topicId/studied")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Mark (or unmark) a weak topic as studied" })
  async studied(
    @CurrentUser() user: RequestUser,
    @Param("topicId", ParseUUIDPipe) topicId: string,
    @Body() dto: StudiedDto,
  ): Promise<void> {
    await this.practice.markStudied(user.id, topicId, dto.studied);
  }
}

@ApiTags("admin: practice categories")
@Controller("admin/practice")
@RequirePermissions("quiz:manage")
export class AdminPracticeController {
  constructor(private readonly practice: PracticeService) {}

  @Get("courses/:courseId/categories")
  @ApiOperation({ summary: "List a course's practice categories" })
  async list(@Param("courseId", ParseUUIDPipe) courseId: string) {
    const rows = await this.practice.listCategories(courseId);
    return rows.map((c) => ({
      id: c.id,
      courseId: c.courseId,
      title: c.title,
      description: c.description,
      position: c.position,
      quizCount: c._count.quizzes,
    }));
  }

  @Post("courses/:courseId/categories")
  @ApiOperation({ summary: "Create a practice category" })
  create(@Param("courseId", ParseUUIDPipe) courseId: string, @Body() dto: PracticeCategoryDto) {
    return this.practice.createCategory(courseId, dto);
  }

  @Patch("categories/:id")
  @ApiOperation({ summary: "Rename / reorder a practice category" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePracticeCategoryDto) {
    return this.practice.updateCategory(id, dto);
  }

  @Delete("categories/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a category (its tests stay, unlisted)" })
  async remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.practice.deleteCategory(id);
  }
}
