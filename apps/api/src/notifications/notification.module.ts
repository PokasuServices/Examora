import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AdminNotificationsController } from "./admin/admin-notifications.controller";
import { NotificationTemplatesAdminController } from "./admin/notification-templates-admin.controller";
import { EmailChannelService } from "./channels/email-channel.service";
import { MobilePushChannelService } from "./channels/mobile-push-channel.service";
import { SmsChannelService } from "./channels/sms-channel.service";
import { WebPushChannelService } from "./channels/web-push-channel.service";
import { WhatsAppChannelService } from "./channels/whatsapp-channel.service";
import { NOTIFICATION_DELIVERY_QUEUE, NOTIFICATION_SCHEDULE_QUEUE } from "./notification.constants";
import { NotificationDeliveryProcessor } from "./notification-delivery.processor";
import { NotificationPreferencesController } from "./notification-preferences.controller";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { NotificationQueueService } from "./notification-queue.service";
import { NotificationScheduleProcessor } from "./notification-schedule.processor";
import { NotificationTemplatesService } from "./notification-templates.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import {
  EMAIL_CHANNEL_PORT,
  MOBILE_PUSH_CHANNEL_PORT,
  SMS_CHANNEL_PORT,
  WEB_PUSH_CHANNEL_PORT,
  WHATSAPP_CHANNEL_PORT,
} from "./ports/channel-sender.port";
import { WebPushSubscriptionsController } from "./web-push-subscriptions.controller";
import { WebPushSubscriptionsService } from "./web-push-subscriptions.service";

/**
 * Cross-cutting, `@Global()` (ADR-0019 §1, mirroring AuditModule) — every
 * other feature module injects `NotificationsService` directly at its
 * integration point, the same idiom already used for `AuditService`. This
 * module imports nothing from any feature module.
 */
@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: NOTIFICATION_DELIVERY_QUEUE },
      { name: NOTIFICATION_SCHEDULE_QUEUE },
    ),
  ],
  // NotificationTemplatesAdminController MUST be registered before
  // AdminNotificationsController — Nest/Express matches routes in
  // registration order, and AdminNotificationsController's `GET
  // admin/notifications/:id` (ParseUUIDPipe) would otherwise swallow
  // `GET admin/notifications/templates` (the templates list), matching
  // "templates" as the :id and 400ing with "uuid is expected".
  controllers: [
    NotificationsController,
    NotificationPreferencesController,
    WebPushSubscriptionsController,
    NotificationTemplatesAdminController,
    AdminNotificationsController,
  ],
  providers: [
    NotificationsService,
    NotificationQueueService,
    NotificationTemplatesService,
    NotificationPreferencesService,
    WebPushSubscriptionsService,
    NotificationDeliveryProcessor,
    NotificationScheduleProcessor,
    { provide: EMAIL_CHANNEL_PORT, useClass: EmailChannelService },
    { provide: SMS_CHANNEL_PORT, useClass: SmsChannelService },
    { provide: WHATSAPP_CHANNEL_PORT, useClass: WhatsAppChannelService },
    { provide: WEB_PUSH_CHANNEL_PORT, useClass: WebPushChannelService },
    { provide: MOBILE_PUSH_CHANNEL_PORT, useClass: MobilePushChannelService },
  ],
  exports: [
    NotificationsService,
    NotificationQueueService,
    NotificationPreferencesService,
    WebPushSubscriptionsService,
  ],
})
export class NotificationModule {}
