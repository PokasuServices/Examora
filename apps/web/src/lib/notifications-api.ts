"use client";

import { useAuth } from "@examora/auth-client";
import type {
  NotificationPreferenceDto,
  NotificationSummary,
  NotificationUnreadCount,
  PaginatedData,
} from "@examora/types";

export interface WebPushSubscriptionSummary {
  id: string;
  endpoint: string;
  createdAt: string;
}

/** Typed wrappers over the caller's own Notification Center / preferences / Web Push endpoints (ADR-0019). */
export function useNotificationsApi() {
  const { request } = useAuth();

  return {
    listMine: (params?: { page?: number; pageSize?: number; unreadOnly?: boolean }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set("page", String(params.page));
      if (params?.pageSize) query.set("pageSize", String(params.pageSize));
      if (params?.unreadOnly) query.set("unreadOnly", "true");
      const qs = query.toString();
      return request<PaginatedData<NotificationSummary>>(`/notifications${qs ? `?${qs}` : ""}`, {
        method: "GET",
      });
    },
    unreadCount: () =>
      request<NotificationUnreadCount>("/notifications/unread-count", { method: "GET" }),
    markRead: (id: string) =>
      request<NotificationSummary>(`/notifications/${id}/read`, { method: "PATCH" }),
    markAllRead: () => request<{ success: boolean }>("/notifications/read-all", { method: "POST" }),

    getPreferences: () =>
      request<NotificationPreferenceDto>("/notifications/preferences", { method: "GET" }),
    updatePreferences: (dto: Partial<NotificationPreferenceDto>) =>
      request<NotificationPreferenceDto>("/notifications/preferences", {
        method: "PATCH",
        body: dto,
      }),

    listWebPushSubscriptions: () =>
      request<WebPushSubscriptionSummary[]>("/notifications/web-push-subscriptions", {
        method: "GET",
      }),
    subscribeWebPush: (params: { endpoint: string; p256dh: string; auth: string }) =>
      request<WebPushSubscriptionSummary>("/notifications/web-push-subscriptions", {
        method: "POST",
        body: params,
      }),
    unsubscribeWebPush: (endpoint: string) =>
      request<void>(
        `/notifications/web-push-subscriptions?endpoint=${encodeURIComponent(endpoint)}`,
        {
          method: "DELETE",
        },
      ),
  };
}
