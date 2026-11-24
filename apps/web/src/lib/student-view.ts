import type { AuthenticatedUser, RoleName } from "@examora/types";

const STAFF_ROLES: RoleName[] = ["ADMINISTRATOR", "MENTOR", "REVIEWER", "GUARDIAN"];

/**
 * Students get the student shell (Study / Explore Colleges / Rewards sidebar).
 * Anyone who also holds a staff or guardian role keeps the full platform
 * shell, since that is where their own tools live.
 */
export function isStudentView(user: AuthenticatedUser | null | undefined): boolean {
  if (!user) return false;
  return user.roles.includes("STUDENT") && !user.roles.some((r) => STAFF_ROLES.includes(r));
}

/** Where a signed-in student lands after login. */
export const STUDENT_HOME = "/learn";
