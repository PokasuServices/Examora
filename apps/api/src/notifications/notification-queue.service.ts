import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import {
  NOTIFICATION_DELIVERY_QUEUE,
  NOTIFICATION_SCHEDULE_QUEUE,
  type NotificationDeliveryJobData,
  type NotificationScheduleJobData,
} from "./notification.constants";

/** Retry with exponential backoff, mirroring the Sprint 5 malware-scan queue (ADR-0019 §7). */
@Injectable()
export class NotificationQueueService {
  constructor(
    @InjectQueue(NOTIFICATION_DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<NotificationDeliveryJobData>,
    @InjectQueue(NOTIFICATION_SCHEDULE_QUEUE)
    private readonly scheduleQueue: Queue<NotificationScheduleJobData>,
  ) {}

  async enqueueDelivery(deliveryId: string, delayMs?: number): Promise<void> {
    await this.deliveryQueue.add(
      "deliver",
      { deliveryId },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 }, delay: delayMs },
    );
  }

  /** Defers the whole Notification's creation, not just one channel's send (ADR-0019 §10). */
  async scheduleNotification(payload: NotificationScheduleJobData, delayMs: number): Promise<void> {
    await this.scheduleQueue.add("create", payload, {
      delay: delayMs,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
  }
}
