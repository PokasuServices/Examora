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
import { Throttle } from "@nestjs/throttler";
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
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  COLLEGE_CATEGORIES,
  type AdminCollege,
  type AdminWebinar,
  type CollegeDetail,
  type CollegeEnquiryView,
  type CollegeSummary,
  type WebinarDetail,
  type WebinarSummary,
} from "@examora/types";
import type { RequestUser } from "../auth/types/request-user";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { CollegesService } from "./colleges.service";

export class ToggleDto {
  @ApiProperty()
  @IsBoolean()
  on!: boolean;
}

export class EnquiryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

export class CollegeDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: "Bengaluru" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city!: string;

  @ApiProperty({ enum: COLLEGE_CATEGORIES, isArray: true })
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(COLLEGE_CATEGORIES, { each: true })
  categories!: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "Rupees" })
  @IsOptional()
  @IsInt()
  @Min(0)
  applicationFee?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  website?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "Markdown" })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
export class UpdateCollegeDto extends PartialType(CollegeDto) {}

export class WebinarDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID("4")
  collegeId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "Markdown" })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerUrl?: string | null;

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiProperty()
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  joinUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
export class UpdateWebinarDto extends PartialType(WebinarDto) {}

export class EnquiryStatusDto {
  @ApiProperty({ enum: ["NEW", "CONTACTED"] })
  @IsIn(["NEW", "CONTACTED"])
  status!: "NEW" | "CONTACTED";
}

@ApiTags("student: colleges & webinars")
@Controller()
@RequirePermissions("content:read")
export class CollegesController {
  constructor(private readonly colleges: CollegesService) {}

  @Get("colleges")
  @ApiOperation({ summary: "Published colleges, optionally by category" })
  list(
    @CurrentUser() user: RequestUser,
    @Query("category") category?: string,
  ): Promise<CollegeSummary[]> {
    return this.colleges.list(user.id, category);
  }

  @Get("colleges/shortlist")
  @ApiOperation({ summary: "My shortlisted colleges" })
  shortlist(@CurrentUser() user: RequestUser): Promise<CollegeSummary[]> {
    return this.colleges.shortlist(user.id);
  }

  @Get("colleges/:slug")
  @ApiOperation({ summary: "A college's details and upcoming webinars" })
  detail(@CurrentUser() user: RequestUser, @Param("slug") slug: string): Promise<CollegeDetail> {
    return this.colleges.detail(user.id, slug);
  }

  @Put("colleges/:id/shortlist")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Add to / remove from my shortlist" })
  async setShortlist(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ToggleDto,
  ): Promise<void> {
    await this.colleges.setShortlisted(user.id, id, dto.on);
  }

  @Post("colleges/:id/enquiries")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Send an enquiry to a college" })
  async enquire(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: EnquiryDto,
  ): Promise<void> {
    await this.colleges.enquire(user.id, id, dto.message);
  }

  @Get("webinars")
  @ApiOperation({ summary: "Upcoming webinars" })
  webinars(@CurrentUser() user: RequestUser): Promise<WebinarSummary[]> {
    return this.colleges.webinars(user.id);
  }

  @Get("webinars/:slug")
  @ApiOperation({ summary: "A webinar (join link only after registering)" })
  webinar(@CurrentUser() user: RequestUser, @Param("slug") slug: string): Promise<WebinarDetail> {
    return this.colleges.webinar(user.id, slug);
  }

  @Put("webinars/:id/registration")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Register for / cancel a webinar" })
  async register(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ToggleDto,
  ): Promise<void> {
    await this.colleges.setRegistered(user.id, id, dto.on);
  }
}

@ApiTags("admin: colleges & webinars")
@Controller("admin")
@RequirePermissions("content:manage")
export class AdminCollegesController {
  constructor(private readonly colleges: CollegesService) {}

  @Get("colleges")
  listColleges(): Promise<AdminCollege[]> {
    return this.colleges.adminColleges();
  }

  @Post("colleges")
  createCollege(@Body() dto: CollegeDto) {
    return this.colleges.createCollege(dto);
  }

  @Patch("colleges/:id")
  updateCollege(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCollegeDto) {
    return this.colleges.updateCollege(id, dto);
  }

  @Delete("colleges/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCollege(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.colleges.deleteCollege(id);
  }

  @Get("webinars")
  listWebinars(): Promise<AdminWebinar[]> {
    return this.colleges.adminWebinars();
  }

  @Post("webinars")
  createWebinar(@Body() dto: WebinarDto) {
    return this.colleges.createWebinar(dto);
  }

  @Patch("webinars/:id")
  updateWebinar(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateWebinarDto) {
    return this.colleges.updateWebinar(id, dto);
  }

  @Delete("webinars/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWebinar(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.colleges.deleteWebinar(id);
  }

  @Get("college-enquiries")
  enquiries(): Promise<CollegeEnquiryView[]> {
    return this.colleges.enquiries();
  }

  @Patch("college-enquiries/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async enquiryStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: EnquiryStatusDto,
  ): Promise<void> {
    await this.colleges.setEnquiryStatus(id, dto.status);
  }
}
