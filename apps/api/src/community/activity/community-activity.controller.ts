import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { CommunityActivityItem } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../../auth/types/request-user";
import { CommunityAccessService } from "../common/community-access.service";
import { CommunityActivityService } from "./community-activity.service";

/** A user's own community activity timeline, or an admin's view of another's (ADR-0017). */
@ApiTags("community: activity")
@Controller("community/activity")
@RequirePermissions("community:read")
export class CommunityActivityController {
  constructor(
    private readonly activityService: CommunityActivityService,
    private readonly accessService: CommunityAccessService,
  ) {}

  @Get(":userId")
  @ApiOperation({ summary: "Get a user's community activity timeline (self or moderator)" })
  async getTimeline(
    @CurrentUser() actor: RequestUser,
    @Param("userId", ParseUUIDPipe) userId: string,
  ): Promise<CommunityActivityItem[]> {
    await this.accessService.assertOwnerOrModerator(actor, userId);
    return this.activityService.getTimeline(userId);
  }
}
