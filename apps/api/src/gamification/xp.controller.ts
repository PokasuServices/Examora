import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { XpSummary } from "@examora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/types/request-user";
import { XpService } from "./xp.service";

@ApiTags("gamification")
@Controller("me/xp")
@RequirePermissions("profile:read:own")
export class XpController {
  constructor(private readonly xpService: XpService) {}

  @Get()
  @ApiOperation({ summary: "My total XP and progress to the next milestone card" })
  async getMine(@CurrentUser() actor: RequestUser): Promise<XpSummary> {
    return this.xpService.getSummary(actor.id);
  }
}
