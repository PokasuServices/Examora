import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import type { NotificationChannel } from "@examora/types";
import {
  NOTIFICATION_SCHEDULE_QUEUE,
  type NotificationScheduleJobData,
} from "./notification.constants";
import { NotificationsService } from "./notifications.service";

/**
 * Fires a delayed notification at the scheduled time by finally calling
 * `NotificationsService.enqueue()` — the `Notification`/`NotificationDelivery`
 * rows (and in-app visibility) don't exist until this runs (ADR-0019 §10).
 */
@Processor(NOTIFICATION_SCHEDULE_QUEUE)
export class NotificationScheduleProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationScheduleProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<NotificationScheduleJobData>): Promise<void> {
    const { data } = job;
    await this.notificationsService.enqueue({
      userId: data.userId,
      eventType: data.eventType,
      category: data.category,
      title: data.title,
      body: data.body,
      data: data.data,
      channels: data.channels as NotificationChannel[] | undefined,
    });
    this.logger.log(`Fired scheduled notification "${data.eventType}" for user ${data.userId}`);
  }
}
