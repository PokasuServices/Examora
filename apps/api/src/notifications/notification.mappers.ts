import type {
  NotificationDeliverySummary,
  NotificationDetail,
  NotificationPreferenceDto,
  NotificationSummary,
  NotificationTemplateDto,
} from "@examora/types";

type NotificationDeliveryRow = {
  id: string;
  channel: string;
  status: string;
  attempts: number;
  lastError: string | null;
  suppressedReason: string | null;
  fallbackFromId: string | null;
  queuedAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  acknowledgedAt: Date | null;
  failedAt: Date | null;
};

export function toNotificationDelivery(row: NotificationDeliveryRow): NotificationDeliverySummary {
  return {
    id: row.id,
    channel: row.channel as NotificationDeliverySummary["channel"],
    status: row.status as NotificationDeliverySummary["status"],
    attempts: row.attempts,
    lastError: row.lastError,
    suppressedReason: row.suppressedReason,
    fallbackFromId: row.fallbackFromId,
    queuedAt: row.queuedAt.toISOString(),
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    openedAt: row.openedAt ? row.openedAt.toISOString() : null,
    clickedAt: row.clickedAt ? row.clickedAt.toISOString() : null,
    acknowledgedAt: row.acknowledgedAt ? row.acknowledgedAt.toISOString() : null,
    failedAt: row.failedAt ? row.failedAt.toISOString() : null,
  };
}

type NotificationRow = {
  id: string;
  eventType: string;
  category: string;
  title: string;
  body: string;
  data: unknown;
  isTransactional: boolean;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
};

export function toNotificationSummary(row: NotificationRow): NotificationSummary {
  return {
    id: row.id,
    eventType: row.eventType,
    category: row.category,
    title: row.title,
    body: row.body,
    data: (row.data as Record<string, unknown> | null) ?? null,
    isTransactional: row.isTransactional,
    isRead: row.isRead,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

type NotificationDetailRow = NotificationRow & {
  userId: string;
  user: { email: string };
  deliveries: NotificationDeliveryRow[];
};

export function toNotificationDetail(row: NotificationDetailRow): NotificationDetail {
  return {
    ...toNotificationSummary(row),
    userId: row.userId,
    userEmail: row.user.email,
    deliveries: row.deliveries.map(toNotificationDelivery),
  };
}

type PreferenceRow = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  webPushEnabled: boolean;
  inAppEnabled: boolean;
  mutedCategories: string[];
  dndStartMinute: number | null;
  dndEndMinute: number | null;
  digestMode: string;
  language: string;
  timezone: string;
};

export function toPreferenceDto(row: PreferenceRow): NotificationPreferenceDto {
  return {
    emailEnabled: row.emailEnabled,
    smsEnabled: row.smsEnabled,
    whatsappEnabled: row.whatsappEnabled,
    webPushEnabled: row.webPushEnabled,
    inAppEnabled: row.inAppEnabled,
    mutedCategories: row.mutedCategories,
    dndStartMinute: row.dndStartMinute,
    dndEndMinute: row.dndEndMinute,
    digestMode: row.digestMode as NotificationPreferenceDto["digestMode"],
    language: row.language,
    timezone: row.timezone,
  };
}

type TemplateRow = {
  id: string;
  eventType: string;
  channel: string;
  subject: string | null;
  bodyTemplate: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toTemplateDto(row: TemplateRow): NotificationTemplateDto {
  return {
    id: row.id,
    eventType: row.eventType,
    channel: row.channel as NotificationTemplateDto["channel"],
    subject: row.subject,
    bodyTemplate: row.bodyTemplate,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
