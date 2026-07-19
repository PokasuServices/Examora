import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "./permissions.guard";
import type { PermissionsService } from "../../permissions/permissions.service";

function buildContext(user: { id: string; roles: string[] } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user, method: "GET", url: "/admin/users" }),
    }),
  } as unknown as ExecutionContext;
}

describe("PermissionsGuard", () => {
  it("allows the request when no permissions are required", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const permissionsService = {
      getPermissionsForRoles: jest.fn(),
    } as unknown as PermissionsService;
    const guard = new PermissionsGuard(reflector, permissionsService);

    await expect(guard.canActivate(buildContext({ id: "u1", roles: ["STUDENT"] }))).resolves.toBe(
      true,
    );
    expect(permissionsService.getPermissionsForRoles).not.toHaveBeenCalled();
  });

  it("allows the request when the user holds every required permission", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["users:manage"]),
    } as unknown as Reflector;
    const permissionsService = {
      getPermissionsForRoles: jest.fn().mockResolvedValue(["users:manage", "roles:manage"]),
    } as unknown as PermissionsService;
    const guard = new PermissionsGuard(reflector, permissionsService);

    await expect(
      guard.canActivate(buildContext({ id: "u1", roles: ["ADMINISTRATOR"] })),
    ).resolves.toBe(true);
  });

  it("denies the request when the user is missing a required permission", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["users:manage"]),
    } as unknown as Reflector;
    const permissionsService = {
      getPermissionsForRoles: jest.fn().mockResolvedValue(["profile:read:own"]),
    } as unknown as PermissionsService;
    const guard = new PermissionsGuard(reflector, permissionsService);

    await expect(
      guard.canActivate(buildContext({ id: "u1", roles: ["STUDENT"] })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("denies the request when there is no authenticated user", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["users:manage"]),
    } as unknown as Reflector;
    const permissionsService = {
      getPermissionsForRoles: jest.fn(),
    } as unknown as PermissionsService;
    const guard = new PermissionsGuard(reflector, permissionsService);

    await expect(guard.canActivate(buildContext(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
