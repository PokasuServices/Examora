import { SetMetadata } from "@nestjs/common";
import type { PermissionCode } from "@examora/types";

export const REQUIRE_PERMISSIONS_KEY = "requiredPermissions";

/**
 * Fine-grained permission check (DESIGN-03 §3 "Permissions Framework"),
 * distinct from and complementary to @Roles(): a role decides broad access,
 * a permission decides a specific action. Enforced by PermissionsGuard.
 */
export const RequirePermissions = (
  ...permissions: PermissionCode[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
