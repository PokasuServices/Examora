/**
 * Notification delivery-state taxonomy per the merged notification spec
 * (documents/COMM-MERGED_..., ADR-0004). Implemented here, ahead of the
 * Sprint 9 Notification Service, so any early modeling stays consistent.
 */
export const NOTIFICATION_LIFECYCLE_STATES = [
  "QUEUED",
  "SENT",
  "DELIVERED",
  "OPENED",
  "CLICKED",
  "ACKNOWLEDGED",
] as const;

export const NOTIFICATION_SIDE_STATES = ["FAILED", "RETRIED", "SUPPRESSED"] as const;

export type NotificationLifecycleState = (typeof NOTIFICATION_LIFECYCLE_STATES)[number];
export type NotificationSideState = (typeof NOTIFICATION_SIDE_STATES)[number];
export type NotificationState = NotificationLifecycleState | NotificationSideState;

export const NOTIFICATION_CHANNELS = [
  "EMAIL",
  "SMS",
  "WHATSAPP",
  "IN_APP",
  "WEB_PUSH",
  "MOBILE_PUSH",
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
