import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  Post,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { UserProfile } from "@examora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { AuditService } from "../audit/audit.service";
import { PermissionsService } from "../permissions/permissions.service";
import type { RequestUser } from "../auth/types/request-user";
import { RecordConsentDto } from "./dto/record-consent.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { toUserProfile } from "./user-profile.mapper";
import { UsersService } from "./users.service";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "Current user's full profile (FR-PROFILE-01)" })
  async me(@CurrentUser() user: RequestUser): Promise<UserProfile> {
    const record = await this.usersService.findByIdWithRoles(user.id);
    if (!record) {
      throw new NotFoundException("User not found");
    }
    return this.toProfile(record);
  }

  @Put("me")
  @ApiOperation({ summary: "Update the current user's profile" })
  async updateMe(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    const before = await this.usersService.findByIdWithRoles(user.id);
    const updated = await this.usersService.updateProfile(user.id, dto);

    await this.auditService.record({
      actorId: user.id,
      action: "profile.updated",
      entityType: "User",
      entityId: user.id,
      before: before ? { firstName: before.firstName, lastName: before.lastName } : undefined,
      after: { firstName: updated.firstName, lastName: updated.lastName },
    });

    return this.toProfile(updated);
  }

  @Post("me/consent")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Record a consent decision (accept/withdraw) for the current user" })
  async recordConsent(
    @CurrentUser() user: RequestUser,
    @Body() dto: RecordConsentDto,
    @Req() req: Request,
  ): Promise<{ status: string }> {
    await this.usersService.recordConsent(user.id, dto);

    await this.auditService.record({
      actorId: user.id,
      action: dto.granted ? "consent.granted" : "consent.withdrawn",
      entityType: "User",
      entityId: user.id,
      after: { type: dto.type, version: dto.version, channel: dto.channel },
      ipAddress: req.ip,
      correlationId: req.headers["x-correlation-id"] as string | undefined,
    });

    return { status: "recorded" };
  }

  @Get(":id")
  @RequirePermissions("users:manage")
  @ApiOperation({ summary: "View another user's profile (staff only)" })
  async findById(@Param("id") id: string): Promise<UserProfile> {
    const record = await this.usersService.findByIdWithRoles(id);
    if (!record) {
      throw new NotFoundException("User not found");
    }
    return this.toProfile(record);
  }

  private async toProfile(
    user: NonNullable<Awaited<ReturnType<UsersService["findByIdWithRoles"]>>>,
  ): Promise<UserProfile> {
    const roles = user.roles.map((userRole) => userRole.role.name) as UserProfile["roles"];
    const permissions = await this.permissionsService.getPermissionsForRoles(roles);
    return toUserProfile(user, permissions);
  }
}
