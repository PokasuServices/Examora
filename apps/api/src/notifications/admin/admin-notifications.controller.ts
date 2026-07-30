import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { NotificationDetail, PaginatedData } from "@examora/types";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { requestAuditMeta } from "../../common/request-meta";
import { AuditService } from "../../audit/audit.service";
import type { RequestUser } from "../../auth/types/request-user";
import { BroadcastDto } from "../dto/broadcast.dto";
import { ListNotificationsAdminQueryDto } from "../dto/list-notifications-admin-query.dto";
import { toNotificationDetail } from "../notification.mappers";
import { NotificationsService } from "../notifications.service";

/** Delivery-tracking dashboard + broadcast/announcement composer (ADR-0019). */
@ApiTags("notifications (admin)")
@Controller("admin/notifications")
@RequirePermissions("notification:manage")
export class AdminNotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List all notifications with delivery state (commerce:manage-style dashboard)",
  })
  async list(
    @Query() query: ListNotificationsAdminQueryDto,
  ): Promise<PaginatedData<NotificationDetail>> {
    const { items, total } = await this.notificationsService.listAll({
      page: query.page,
      pageSize: query.pageSize,
      userId: query.userId,
      category: query.category,
      eventType: query.eventType,
    });
    return {
      items: items.map(toNotificationDetail),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get any notification with full delivery history" })
  async findById(@Param("id", ParseUUIDPipe) id: string): Promise<NotificationDetail> {
    return toNotificationDetail(await this.notificationsService.getByIdOrThrow(id));
  }

  @Post("broadcast")
  @ApiOperation({ summary: "Send a cohort or platform-wide announcement" })
  async broadcast(
    @CurrentUser() actor: RequestUser,
    @Body() dto: BroadcastDto,
    @Req() req: Request,
  ): Promise<{ count: number }> {
    const result = await this.notificationsService.broadcast(dto);
    await this.auditService.record({
      actorId: actor.id,
      action: "notifications.broadcast_sent",
      entityType: "Notification",
      after: { eventType: dto.eventType, recipientCount: result.count, title: dto.title },
      ...requestAuditMeta(req),
    });
    return result;
  }
}
