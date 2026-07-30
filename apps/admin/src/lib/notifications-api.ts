"use client";

import { useAuth } from "@examora/auth-client";
import type {
  NotificationChannel,
  NotificationDetail,
  NotificationTemplateDto,
  PaginatedData,
} from "@examora/types";

const BASE = "/admin/notifications";

/** Typed wrappers over the admin delivery-tracking / broadcast / template endpoints (ADR-0019). */
export function useNotificationsAdminApi() {
  const { request } = useAuth();

  return {
    list: (params?: { userId?: string; category?: string; eventType?: string }) => {
      const qs = new URLSearchParams({ pageSize: "50" });
      if (params?.userId) qs.set("userId", params.userId);
      if (params?.category) qs.set("category", params.category);
      if (params?.eventType) qs.set("eventType", params.eventType);
      return request<PaginatedData<NotificationDetail>>(`${BASE}?${qs.toString()}`, {
        method: "GET",
      });
    },
    getById: (id: string) => request<NotificationDetail>(`${BASE}/${id}`, { method: "GET" }),
    broadcast: (body: {
      userIds: string[];
      eventType: string;
      category: string;
      title: string;
      body: string;
      channels?: NotificationChannel[];
    }) => request<{ count: number }>(`${BASE}/broadcast`, { method: "POST", body }),

    listTemplates: () =>
      request<PaginatedData<NotificationTemplateDto>>(`${BASE}/templates?pageSize=100`, {
        method: "GET",
      }),
    getTemplate: (id: string) =>
      request<NotificationTemplateDto>(`${BASE}/templates/${id}`, { method: "GET" }),
    createTemplate: (body: {
      eventType: string;
      channel: NotificationChannel;
      subject?: string;
      bodyTemplate: string;
      isActive?: boolean;
    }) => request<NotificationTemplateDto>(`${BASE}/templates`, { method: "POST", body }),
    updateTemplate: (
      id: string,
      body: Partial<{ subject: string; bodyTemplate: string; isActive: boolean }>,
    ) => request<NotificationTemplateDto>(`${BASE}/templates/${id}`, { method: "PATCH", body }),
  };
}
