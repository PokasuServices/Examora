"use client";

import { useAuth } from "@examora/auth-client";
import type {
  CommunityReport,
  CommunityReportStatus,
  NotificationTemplateDto,
  OrderDetail,
  PaginatedData,
  RefundStatus,
  RefundSummary,
} from "@examora/types";

// /health is deliberately excluded from the /api/v1 prefix (see apps/api/src/setup-app.ts) so
// infra tooling can hit a stable, unversioned URL — it lives on the API origin, not the /api/v1 base.
const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3001";

export interface HealthCheckResult {
  status: "ok" | "error" | "shutting_down";
  details?: Record<string, { status: string }>;
}

/**
 * Typed wrappers over the admin-only endpoints not already covered by another
 * lib file: platform health (public), admin order/refund monitoring
 * (commerce:manage), the community report queue (community:moderate), and
 * notification templates (notification:manage). Analytics itself is reused
 * from useAdminAnalyticsApi() — not duplicated here.
 */
export function useAdminDashboardApi() {
  const { request } = useAuth();

  return {
    /** /health is excluded from the /api/v1 prefix and unauthenticated — a plain fetch, not request(). */
    getHealth: async (): Promise<HealthCheckResult> => {
      const res = await fetch(`${API_ORIGIN}/health`, { signal: AbortSignal.timeout(5000) });
      const body = (await res.json().catch(() => null)) as { data?: HealthCheckResult } | null;
      if (!body?.data) return { status: "error" };
      return body.data;
    },

    listRecentOrders: (pageSize = 6) =>
      request<PaginatedData<OrderDetail>>(`/admin/commerce/orders?pageSize=${pageSize}`, {
        method: "GET",
      }),

    listRefundQueue: (status: RefundStatus = "REQUESTED", pageSize = 6) =>
      request<PaginatedData<RefundSummary>>(
        `/admin/commerce/refunds?status=${status}&pageSize=${pageSize}`,
        { method: "GET" },
      ),

    listModerationQueue: (status: CommunityReportStatus = "PENDING", pageSize = 6) =>
      request<PaginatedData<CommunityReport>>(
        `/community/moderation/reports?status=${status}&pageSize=${pageSize}`,
        { method: "GET" },
      ),

    listTemplates: (pageSize = 1) =>
      request<PaginatedData<NotificationTemplateDto>>(
        `/admin/notifications/templates?pageSize=${pageSize}`,
        { method: "GET" },
      ),
  };
}
