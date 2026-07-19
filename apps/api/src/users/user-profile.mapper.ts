import type { PermissionCode, UserProfile } from "@examora/types";
import type { UsersService } from "./users.service";

type UserWithRoles = NonNullable<Awaited<ReturnType<UsersService["findByIdWithRoles"]>>>;

/** Shared by UsersController and AdminUsersController — do not duplicate. */
export function toUserProfile(user: UserWithRoles, permissions: PermissionCode[]): UserProfile {
  const roles = user.roles.map((userRole) => userRole.role.name) as UserProfile["roles"];

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
    roles,
    permissions,
    phone: user.phone,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
    guardianName: user.guardianName,
    guardianEmail: user.guardianEmail,
    consentVersion: user.consentVersion,
    consentedAt: user.consentedAt ? user.consentedAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}
