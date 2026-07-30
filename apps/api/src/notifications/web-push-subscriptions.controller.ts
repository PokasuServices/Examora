import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsUrl } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/types/request-user";
import { CreateWebPushSubscriptionDto } from "./dto/create-web-push-subscription.dto";
import { WebPushSubscriptionsService } from "./web-push-subscriptions.service";

class EndpointQueryDto {
  @IsUrl({ require_tld: false })
  endpoint!: string;
}

/** A student's own Web Push subscriptions — register/unregister per browser/device (ADR-0019 §6). */
@ApiTags("notifications")
@Controller("notifications/web-push-subscriptions")
@RequirePermissions("notification:read")
export class WebPushSubscriptionsController {
  constructor(private readonly subscriptionsService: WebPushSubscriptionsService) {}

  @Post()
  @ApiOperation({ summary: "Register a browser's Web Push subscription" })
  async subscribe(@CurrentUser() actor: RequestUser, @Body() dto: CreateWebPushSubscriptionDto) {
    return this.subscriptionsService.subscribe(actor.id, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Unregister a Web Push subscription by endpoint" })
  async unsubscribe(
    @CurrentUser() actor: RequestUser,
    @Query() query: EndpointQueryDto,
  ): Promise<void> {
    await this.subscriptionsService.unsubscribe(actor.id, query.endpoint);
  }

  @Get()
  @ApiOperation({ summary: "List the caller's registered Web Push subscriptions" })
  async listMine(@CurrentUser() actor: RequestUser) {
    return this.subscriptionsService.listMine(actor.id);
  }
}
