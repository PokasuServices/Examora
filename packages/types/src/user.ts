/** Mirrors the `user_status` enum in database/prisma/schema.prisma. */
export const USER_STATUSES = [
  "PENDING_VERIFICATION",
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "ARCHIVED",
] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

/** Public-safe user shape — never includes passwordHash or internal audit fields. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: UserStatus;
  emailVerified: boolean;
  roles: import("./role").RoleName[];
  permissions: import("./permission").PermissionCode[];
}

/** Fuller profile shape for GET/PUT /users/me (FR-PROFILE-01) — identity fields only. */
export interface UserProfile extends AuthenticatedUser {
  phone: string | null;
  dateOfBirth: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  consentVersion: string | null;
  consentedAt: string | null;
  createdAt: string;
}
