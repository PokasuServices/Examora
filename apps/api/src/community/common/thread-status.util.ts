import { BadRequestException } from "@nestjs/common";
import type { ThreadStatus } from "@examora/types";

/**
 * Allowed OPEN/CLOSED transitions (ADR-0017) — mirrors
 * `content-status.util.ts#assertValidStatusTransition`'s shape, applied to
 * the thread's linear status dimension only (isPinned/isLocked/isHidden are
 * independent booleans, not part of this transition).
 */
const ALLOWED_TRANSITIONS: Record<ThreadStatus, ThreadStatus[]> = {
  OPEN: ["CLOSED"],
  CLOSED: ["OPEN"],
};

export function assertValidThreadStatusTransition(from: ThreadStatus, to: ThreadStatus): void {
  if (from === to) {
    return;
  }
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new BadRequestException(`Cannot change thread status from ${from} to ${to}`);
  }
}
