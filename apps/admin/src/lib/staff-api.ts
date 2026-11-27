"use client";

import { useAuth } from "@examora/auth-client";
import type {
  DeletionPreview,
  DeletionRequestStatus,
  DeletionRequestView,
  DeletionTargetType,
} from "@examora/types";

/** Deletion requests: mentors ask, administrators decide (mentor module, MF0). */
export function useStaffApi() {
  const { request } = useAuth();
  return {
    previewDeletion: (targetType: DeletionTargetType, targetId: string) =>
      request<DeletionPreview>(
        `/deletion-requests/preview?targetType=${targetType}&targetId=${targetId}`,
        { method: "GET" },
      ),
    requestDeletion: (targetType: DeletionTargetType, targetId: string, reason: string) =>
      request<DeletionRequestView>("/deletion-requests", {
        method: "POST",
        body: { targetType, targetId, reason },
      }),
    myDeletionRequests: () =>
      request<DeletionRequestView[]>("/deletion-requests/mine", { method: "GET" }),
    deletionRequests: (status?: DeletionRequestStatus) =>
      request<DeletionRequestView[]>(`/deletion-requests${status ? `?status=${status}` : ""}`, {
        method: "GET",
      }),
    approveDeletion: (id: string, note?: string) =>
      request<DeletionRequestView>(`/deletion-requests/${id}/approve`, {
        method: "POST",
        body: { note },
      }),
    rejectDeletion: (id: string, note: string) =>
      request<DeletionRequestView>(`/deletion-requests/${id}/reject`, {
        method: "POST",
        body: { note },
      }),
  };
}
