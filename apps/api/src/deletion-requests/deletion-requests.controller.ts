import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import {
  DELETION_TARGET_TYPES,
  type DeletionPreview,
  type DeletionRequestStatus,
  type DeletionRequestView,
  type DeletionTargetType,
} from "@examora/types";
import type { RequestUser } from "../auth/types/request-user";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { DeletionRequestsService } from "./deletion-requests.service";
import { StaffScopeService, type ScopeKind } from "../staff/staff-scope.service";

/** Which scope check covers each deletable record (null = mentors can't ask). */
const TARGET_SCOPE: Record<DeletionTargetType, ScopeKind | null> = {
  category: null,
  course: "course",
  subject: "subject",
  topic: "topic",
  module: "module",
  lesson: "lesson",
  question: "question",
  quiz: "quiz",
  assignment: "assignment",
  "assignment-template": null,
  "practice-category": "practiceCategory",
  rubric: null,
  checkpoint: null,
  college: null,
  webinar: null,
  batch: "cohort",
};

export class DeletionTargetQueryDto {
  @ApiProperty({ enum: DELETION_TARGET_TYPES })
  @IsIn([...DELETION_TARGET_TYPES])
  targetType!: DeletionTargetType;

  @ApiProperty()
  @IsUUID("4")
  targetId!: string;
}

export class CreateDeletionRequestDto extends DeletionTargetQueryDto {
  @ApiProperty({ example: "Duplicate of the newer Mock Test 3" })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

export class DecideDeletionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RejectDeletionDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  note!: string;
}

export class DeletionListQueryDto {
  @ApiPropertyOptional({ enum: ["PENDING", "APPROVED", "REJECTED"] })
  @IsOptional()
  @IsIn(["PENDING", "APPROVED", "REJECTED"])
  status?: DeletionRequestStatus;
}

@ApiTags("staff: deletion requests")
@Controller("deletion-requests")
export class DeletionRequestsController {
  constructor(
    private readonly requests: DeletionRequestsService,
    private readonly staffScope: StaffScopeService,
  ) {}

  /** A mentor may only ask about records inside their own courses and batches. */
  private async assertInScope(actor: RequestUser, type: DeletionTargetType, id: string) {
    if (!this.staffScope.isScoped(actor)) return;
    const kind = TARGET_SCOPE[type];
    if (!kind) throw new NotFoundException("Not found");
    await this.staffScope.assert(actor, kind, id);
  }

  @Get("preview")
  @RequirePermissions("deletion:request")
  @ApiOperation({ summary: "What deleting a record would affect (and any open request)" })
  async preview(
    @CurrentUser() user: RequestUser,
    @Query() q: DeletionTargetQueryDto,
  ): Promise<DeletionPreview> {
    await this.assertInScope(user, q.targetType, q.targetId);
    return this.requests.preview(q.targetType, q.targetId);
  }

  @Post()
  @RequirePermissions("deletion:request")
  @ApiOperation({ summary: "Ask an administrator to delete a record" })
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateDeletionRequestDto,
  ): Promise<DeletionRequestView> {
    await this.assertInScope(user, dto.targetType, dto.targetId);
    return this.requests.create(user.id, dto.targetType, dto.targetId, dto.reason);
  }

  @Get("mine")
  @RequirePermissions("deletion:request")
  @ApiOperation({ summary: "My deletion requests and their outcome" })
  mine(@CurrentUser() user: RequestUser): Promise<DeletionRequestView[]> {
    return this.requests.listMine(user.id);
  }

  @Get()
  @RequirePermissions("deletion:review")
  @ApiOperation({ summary: "Deletion requests to review (pending first)" })
  list(@Query() q: DeletionListQueryDto): Promise<DeletionRequestView[]> {
    return this.requests.list(q.status);
  }

  @Post(":id/approve")
  @RequirePermissions("deletion:review")
  @ApiOperation({ summary: "Approve: the record is deleted and the mentor is told" })
  approve(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DecideDeletionDto,
  ): Promise<DeletionRequestView> {
    return this.requests.approve(user.id, id, dto.note);
  }

  @Post(":id/reject")
  @RequirePermissions("deletion:review")
  @ApiOperation({ summary: "Reject with a reason: the record stays and the mentor is told" })
  reject(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectDeletionDto,
  ): Promise<DeletionRequestView> {
    return this.requests.reject(user.id, id, dto.note);
  }
}
