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
      get: jest.fn().mockReturnValue(undefined),
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
      get: jest.fn().mockReturnValue(undefined),
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
      get: jest.fn().mockReturnValue(undefined),
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
      get: jest.fn().mockReturnValue(undefined),
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

  describe("protected deletes", () => {
    const guardFor = (target: string | null, permissions: string[]) =>
      new PermissionsGuard(
        {
          get: jest.fn().mockReturnValue({ target }),
          getAllAndOverride: jest.fn().mockReturnValue(["content:manage"]),
        } as unknown as Reflector,
        {
          getPermissionsForRoles: jest.fn().mockResolvedValue(permissions),
        } as unknown as PermissionsService,
      );

    it("lets an administrator delete directly", async () => {
      const guard = guardFor("topic", ["content:manage", "deletion:direct"]);
      await expect(
        guard.canActivate(buildContext({ id: "a", roles: ["ADMINISTRATOR"] })),
      ).resolves.toBe(true);
    });

    it("tells a mentor to send a deletion request instead", async () => {
      const guard = guardFor("topic", ["content:manage", "deletion:request"]);
      const err = await guard
        .canActivate(buildContext({ id: "m", roles: ["MENTOR"] }))
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toMatchObject({
        error: "DELETION_NEEDS_APPROVAL",
      });
    });

    it("keeps admin-only deletes for administrators, with nothing to request", async () => {
      const guard = guardFor(null, ["content:manage"]);
      const err = await guard
        .canActivate(buildContext({ id: "m", roles: ["MENTOR"] }))
        .catch((e: unknown) => e);
      expect((err as ForbiddenException).message).toBe("Only an administrator can delete this.");
    });
  });
});
