import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { NotificationPreferenceDto } from "@examora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/types/request-user";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import { toPreferenceDto } from "./notification.mappers";
import { NotificationPreferencesService } from "./notification-preferences.service";

/** A student's own channel/mute/DND/digest/language/timezone preferences (COMM-MERGED §5). */
@ApiTags("notifications")
@Controller("notifications/preferences")
@RequirePermissions("notification:read")
export class NotificationPreferencesController {
  constructor(private readonly preferencesService: NotificationPreferencesService) {}

  @Get()
  @ApiOperation({ summary: "Get the caller's notification preferences" })
  async getMine(@CurrentUser() actor: RequestUser): Promise<NotificationPreferenceDto> {
    return toPreferenceDto(await this.preferencesService.getOrCreate(actor.id));
  }

  @Patch()
  @ApiOperation({ summary: "Update the caller's notification preferences" })
  async updateMine(
    @CurrentUser() actor: RequestUser,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<NotificationPreferenceDto> {
    return toPreferenceDto(await this.preferencesService.update(actor.id, dto));
  }
}
