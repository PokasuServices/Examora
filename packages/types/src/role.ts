/**
 * Platform roles per DESIGN-03 Table 1. Kept in sync with the `role_name` enum
 * in database/prisma/schema.prisma — update both together.
 */
export const ROLE_NAMES = ["STUDENT", "MENTOR", "REVIEWER", "ADMINISTRATOR", "GUARDIAN"] as const;

export type RoleName = (typeof ROLE_NAMES)[number];
