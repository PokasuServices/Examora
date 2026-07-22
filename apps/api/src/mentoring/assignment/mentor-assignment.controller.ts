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
import type { MentorAssignment, PaginatedData } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { toMentorAssignment } from "../mentoring.mappers";
import { AssignMentorDto } from "./dto/assign-mentor.dto";
import { ListMentorAssignmentsQueryDto } from "./dto/list-assignments-query.dto";
import { MentorAssignmentService } from "./mentor-assignment.service";

@ApiTags("mentoring: admin assignment")
@Controller("admin/mentor-assignments")
@RequirePermissions("mentor:manage")
export class MentorAssignmentController {
  constructor(
    private readonly assignmentService: MentorAssignmentService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List mentor↔student assignment history (filter by student/mentor)" })
  async list(
    @Query() query: ListMentorAssignmentsQueryDto,
  ): Promise<PaginatedData<MentorAssignment>> {
    const { items, total } = await this.assignmentService.listHistory({
      page: query.page,
      pageSize: query.pageSize,
      studentId: query.studentId,
      mentorId: query.mentorId,
    });
    return {
      items: items.map(toMentorAssignment),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  @Post(":studentId")
  @ApiOperation({ summary: "Assign or reassign a student's mentor" })
  async assign(
    @CurrentUser() actor: RequestUser,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Body() dto: AssignMentorDto,
    @Req() req: Request,
  ): Promise<MentorAssignment> {
    const assignment = await this.assignmentService.assign(studentId, dto.mentorId, actor.id);
    await this.auditService.record({
      actorId: actor.id,
      action: "mentoring.mentor_assigned",
      entityType: "MentorAssignment",
      entityId: assignment.id,
      after: { studentId, mentorId: dto.mentorId },
      ...requestAuditMeta(req),
    });
    return toMentorAssignment(assignment);
  }

  @Delete(":studentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Unassign a student's current mentor (no replacement)" })
  async unassign(
    @CurrentUser() actor: RequestUser,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.assignmentService.unassign(studentId);
    await this.auditService.record({
      actorId: actor.id,
      action: "mentoring.mentor_unassigned",
      entityType: "MentorAssignment",
      after: { studentId },
      ...requestAuditMeta(req),
    });
  }
}
