export const NOTIFICATION_DELIVERY_QUEUE = "notification-delivery";

export interface NotificationDeliveryJobData {
  deliveryId: string;
}

/**
 * A separate queue for deferred notification *creation* (ADR-0019 §10) —
 * distinct from `NOTIFICATION_DELIVERY_QUEUE`, which only ever delays a
 * single channel's send for an already-created `Notification`. Scheduling
 * (e.g. "remind this student 24h before their assignment deadline") needs
 * the whole `Notification`/`NotificationDelivery` row set, including its
 * in-app visibility, to not exist until the scheduled time — not just a
 * delayed external send of a row that's already sitting in the Notification
 * Center.
 */
export const NOTIFICATION_SCHEDULE_QUEUE = "notification-schedule";

export interface NotificationScheduleJobData {
  userId: string;
  eventType: string;
  category: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels?: string[];
}
