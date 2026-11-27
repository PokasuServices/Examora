import { SetMetadata } from "@nestjs/common";
import type { DeletionTargetType } from "@examora/types";

export const PROTECTED_DELETE_KEY = "protectedDelete";

export interface ProtectedDeleteMeta {
  /** The deletion-request type mentors can ask for; null = admins only, nothing to request. */
  target: DeletionTargetType | null;
}

/**
 * Marks a staff delete endpoint that only someone with `deletion:direct`
 * (administrators) may call. Everyone else gets 403 DELETION_NEEDS_APPROVAL
 * and, when `target` is set, can send a deletion request for an admin to
 * review (mentor module, MF0). Enforced by PermissionsGuard.
 */
export const ProtectedDelete = (target: DeletionTargetType | null): MethodDecorator =>
  SetMetadata(PROTECTED_DELETE_KEY, { target } satisfies ProtectedDeleteMeta);
