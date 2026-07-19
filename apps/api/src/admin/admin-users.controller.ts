import { Body, Controller, Get, Param, Patch, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { PaginatedData, UserProfile } from "@examora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { AuditService } from "../audit/audit.service";
import { PermissionsService } from "../permissions/permissions.service";
import type { RequestUser } from "../auth/types/request-user";
import { toUserProfile } from "../users/user-profile.mapper";
import { UsersService } from "../users/users.service";
import { AssignRolesDto } from "./dto/assign-roles.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";

@ApiTags("admin")
@Controller("admin/users")
@RequirePermissions("users:manage")
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List users (admin only)" })
  async list(@Query() query: PaginationQueryDto): Promise<PaginatedData<UserProfile>> {
    const { items, total } = await this.usersService.list(query.page, query.pageSize);
    const profiles = await Promise.all(items.map((item) => this.toProfile(item)));
    return { items: profiles, page: query.page, pageSize: query.pageSize, total };
  }

  @Patch(":id/roles")
  @ApiOperation({ summary: "Replace a user's role assignments (admin only)" })
  async assignRoles(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: AssignRolesDto,
    @Req() req: Request,
  ): Promise<UserProfile> {
    const before = await this.usersService.findByIdWithRoles(id);
    const updated = await this.usersService.setRoles(id, dto.roles);
    if (!updated) {
      throw new Error("User not found after role update");
    }

    await this.auditService.record({
      actorId: actor.id,
      action: "admin.user_roles_updated",
      entityType: "User",
      entityId: id,
      before: { roles: before?.roles.map((r) => r.role.name) },
      after: { roles: dto.roles },
      ipAddress: req.ip,
      correlationId: req.headers["x-correlation-id"] as string | undefined,
    });

    return this.toProfile(updated);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Suspend, activate or archive a user account (admin only)" })
  async updateStatus(
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: Request,
  ): Promise<UserProfile> {
    const before = await this.usersService.findByIdWithRoles(id);
    const updated = await this.usersService.updateStatus(id, dto.status);

    await this.auditService.record({
      actorId: actor.id,
      action: "admin.user_status_updated",
      entityType: "User",
      entityId: id,
      before: { status: before?.status },
      after: { status: dto.status },
      ipAddress: req.ip,
      correlationId: req.headers["x-correlation-id"] as string | undefined,
    });

    return this.toProfile(updated);
  }

  private async toProfile(
    user: NonNullable<Awaited<ReturnType<UsersService["findByIdWithRoles"]>>>,
  ): Promise<UserProfile> {
    const roles = user.roles.map((userRole) => userRole.role.name) as UserProfile["roles"];
    const permissions = await this.permissionsService.getPermissionsForRoles(roles);
    return toUserProfile(user, permissions);
  }
}
