import { ForbiddenException, Injectable } from "@nestjs/common";
import { PermissionsService } from "../../permissions/permissions.service";
import type { RequestUser } from "../../auth/types/request-user";

/**
 * Row-ownership OR `community:moderate` permission bypass (ADR-0017) —
 * mirrors Sprint 6's `MentorAssignmentService.assertAssignedOrAdmin` shape,
 * generalized to a permission check (community moderation is not tied to a
 * single role, unlike ADMINISTRATOR there) since ADMINISTRATOR already holds
 * every permission code.
 */
@Injectable()
export class CommunityAccessService {
  constructor(private readonly permissionsService: PermissionsService) {}

  async isModerator(actor: RequestUser): Promise<boolean> {
    const granted = await this.permissionsService.getPermissionsForRoles(actor.roles);
    return granted.includes("community:moderate");
  }

  /** Throws unless `actor` owns `ownerId` or holds `community:moderate`. */
  async assertOwnerOrModerator(actor: RequestUser, ownerId: string): Promise<void> {
    if (actor.id === ownerId) return;
    if (await this.isModerator(actor)) return;
    throw new ForbiddenException("You do not own this content");
  }
}
