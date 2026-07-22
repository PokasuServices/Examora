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
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { MentorProfile, MentorWorkload, PaginatedData } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toMentorProfile } from "../mentoring.mappers";
import { CreateMentorProfileDto } from "./dto/create-mentor-profile.dto";
import { UpdateMentorProfileDto } from "./dto/update-mentor-profile.dto";
import { MentorProfilesService } from "./mentor-profiles.service";

@ApiTags("mentoring: admin mentor management")
@Controller("admin/mentors")
@RequirePermissions("mentor:manage")
export class MentorProfilesController {
  constructor(
    private readonly mentorProfilesService: MentorProfilesService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a mentor profile for an existing MENTOR-role user" })
  async create(
    @CurrentUser() actor: RequestUser,
    @Body() dto: CreateMentorProfileDto,
    @Req() req: Request,
  ): Promise<MentorProfile> {
    const profile = await this.mentorProfilesService.create(dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "mentoring.mentor_profile_created",
      entityType: "MentorProfile",
      entityId: profile.id,
      after: { userId: dto.userId },
      ...requestAuditMeta(req),
    });
    return toMentorProfile(profile, 0);
  }

  @Get()
  @ApiOperation({ summary: "List mentor profiles with current workload (admin mentor management)" })
  async list(@Query() query: PaginationQueryDto): Promise<PaginatedData<MentorProfile>> {
    const { items, total } = await this.mentorProfilesService.list({
      page: query.page,
      pageSize: query.pageSize,
    });
    const withWorkload = await Promise.all(
      items.map(async (item) => {
        const count = await this.mentorProfilesService.getActiveStudentCount(item.userId);
        return toMentorProfile(item, count);
      }),
    );
    return { items: withWorkload, page: query.page, pageSize: query.pageSize, total };
  }

  @Get("dashboard")
  @ApiOperation({ summary: "Admin mentor dashboard — every mentor's workload (capacity planning)" })
  async dashboard(): Promise<{
    totalMentors: number;
    totalActiveAssignments: number;
    mentors: MentorWorkload[];
  }> {
    const { items } = await this.mentorProfilesService.list({ page: 1, pageSize: 100 });
    const mentors: MentorWorkload[] = await Promise.all(
      items.map(async (item) => ({
        mentorId: item.userId,
        mentorEmail: item.user.email,
        activeStudentCount: await this.mentorProfilesService.getActiveStudentCount(item.userId),
        maxStudents: item.maxStudents,
      })),
    );
    return {
      totalMentors: mentors.length,
      totalActiveAssignments: mentors.reduce((sum, m) => sum + m.activeStudentCount, 0),
      mentors,
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a mentor profile with current workload" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<MentorProfile> {
    const profile = await this.mentorProfilesService.findByIdOrThrow(id);
    const count = await this.mentorProfilesService.getActiveStudentCount(profile.userId);
    return toMentorProfile(profile, count);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a mentor profile (bio, specialization, capacity)" })
  async update(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMentorProfileDto,
    @Req() req: Request,
  ): Promise<MentorProfile> {
    const updated = await this.mentorProfilesService.update(id, dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "mentoring.mentor_profile_updated",
      entityType: "MentorProfile",
      entityId: id,
      after: { maxStudents: updated.maxStudents },
      ...requestAuditMeta(req),
    });
    const count = await this.mentorProfilesService.getActiveStudentCount(updated.userId);
    return toMentorProfile(updated, count);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a mentor profile (does not unassign existing students)" })
  async remove(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.mentorProfilesService.remove(id);
    await this.auditService.record({
      actorId: actor.id,
      action: "mentoring.mentor_profile_deleted",
      entityType: "MentorProfile",
      entityId: id,
      ...requestAuditMeta(req),
    });
  }
}
