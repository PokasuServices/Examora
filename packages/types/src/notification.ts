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

/** Full delivery-state taxonomy as a single array — matches the Prisma `NotificationDeliveryStatus` enum. */
export const NOTIFICATION_DELIVERY_STATUSES = [
  ...NOTIFICATION_LIFECYCLE_STATES,
  ...NOTIFICATION_SIDE_STATES,
] as const;
export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

export const NOTIFICATION_CHANNELS = [
  "EMAIL",
  "SMS",
  "WHATSAPP",
  "IN_APP",
  "WEB_PUSH",
  "MOBILE_PUSH",
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_DIGEST_MODES = ["INSTANT", "DAILY", "WEEKLY"] as const;
export type NotificationDigestMode = (typeof NOTIFICATION_DIGEST_MODES)[number];

/** Every event type the Notification Service can enqueue (ADR-0019). Grouped by domain, per COMM-MERGED §3. */
export const NOTIFICATION_EVENT_TYPES = [
  // Account & Security
  "auth.welcome",
  "auth.email_verification",
  "auth.password_reset",
  "auth.security_alert",
  // Learning & Assessment
  "enrollment.granted",
  "assignment.due_reminder",
  // Creative Assignments
  "assignment.review_published",
  // Mentoring
  "mentor.assigned",
  // Commerce
  "commerce.payment_success",
  "commerce.payment_failed",
  "commerce.refund_requested",
  "commerce.refund_processed",
  // Platform & Community
  "community.reply_received",
  "community.answer_accepted",
  "community.moderation_action",
  "platform.broadcast_announcement",
] as const;
export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Notification Center / delivery-tracking DTOs
// ---------------------------------------------------------------------------

export interface NotificationDeliverySummary {
  id: string;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  attempts: number;
  lastError: string | null;
  /** Set on a SUPPRESSED delivery — "channel_opted_out" | "category_muted" | "dnd_window". */
  suppressedReason: string | null;
  /** Set when this delivery was created as a channel-fallback escalation from another delivery. */
  fallbackFromId: string | null;
  queuedAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  acknowledgedAt: string | null;
  failedAt: string | null;
}

export interface NotificationSummary {
  id: string;
  eventType: NotificationEventType | string;
  category: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isTransactional: boolean;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationDetail extends NotificationSummary {
  userId: string;
  userEmail: string;
  deliveries: NotificationDeliverySummary[];
}

export interface NotificationPreferenceDto {
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  webPushEnabled: boolean;
  inAppEnabled: boolean;
  mutedCategories: string[];
  dndStartMinute: number | null;
  dndEndMinute: number | null;
  digestMode: NotificationDigestMode;
  language: string;
  timezone: string;
}

export interface NotificationTemplateDto {
  id: string;
  eventType: string;
  channel: NotificationChannel;
  subject: string | null;
  bodyTemplate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationUnreadCount {
  unread: number;
}
