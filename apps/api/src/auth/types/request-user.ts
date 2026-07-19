import type { RoleName } from "@examora/types";

/** Shape attached to `request.user` by JwtStrategy after access-token validation. */
export interface RequestUser {
  id: string;
  email: string;
  roles: RoleName[];
}
