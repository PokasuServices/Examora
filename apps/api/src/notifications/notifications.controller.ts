import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { NotificationSummary, NotificationUnreadCount, PaginatedData } from "@examora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/types/request-user";
import { ListNotificationsQueryDto } from "./dto/list-notifications-query.dto";
import { toNotificationSummary } from "./notification.mappers";
import { NotificationsService } from "./notifications.service";

/** A student's own Notification Center — read/unread, list, mark read (ADR-0019). */
@ApiTags("notifications")
@Controller("notifications")
@RequirePermissions("notification:read")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's notifications" })
  async listMine(
    @CurrentUser() actor: RequestUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<PaginatedData<NotificationSummary>> {
    const { items, total } = await this.notificationsService.listMine(actor.id, {
      page: query.page,
      pageSize: query.pageSize,
      unreadOnly: query.unreadOnly === "true",
    });
    return {
      items: items.map(toNotificationSummary),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Count the caller's unread notifications" })
  async unreadCount(@CurrentUser() actor: RequestUser): Promise<NotificationUnreadCount> {
    return { unread: await this.notificationsService.getUnreadCount(actor.id) };
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark one of the caller's notifications read" })
  async markRead(
    @CurrentUser() actor: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<NotificationSummary> {
    return toNotificationSummary(await this.notificationsService.markRead(actor.id, id));
  }

  @Post("read-all")
  @ApiOperation({ summary: "Mark all of the caller's notifications read" })
  async markAllRead(@CurrentUser() actor: RequestUser): Promise<{ success: boolean }> {
    await this.notificationsService.markAllRead(actor.id);
    return { success: true };
  }
}
