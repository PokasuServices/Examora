import type { UserStatus } from "@examora/types";
import type { ChipTone } from "@/components/ui/chip";

const USER_STATUS_TONE: Record<UserStatus, ChipTone> = {
  PENDING_VERIFICATION: "warning",
  ACTIVE: "success",
  INACTIVE: "neutral",
  SUSPENDED: "danger",
  ARCHIVED: "neutral",
};

export function userStatusTone(status: UserStatus): ChipTone {
  return USER_STATUS_TONE[status];
}
