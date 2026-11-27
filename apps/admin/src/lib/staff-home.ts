import type { AuthenticatedUser } from "@examora/types";

/**
 * Where a signed-in staff member lands. Administrators get the platform
 * dashboard (analytics:admin); a mentor has no platform-wide view, so they
 * land on their Today page instead of an "Access denied" page.
 */
export function staffHome(user: AuthenticatedUser | null | undefined): string {
  if (!user || user.permissions.includes("analytics:admin")) return "/dashboard";
  if (user.permissions.includes("mentor:workflow")) return "/today";
  return "/dashboard";
}
