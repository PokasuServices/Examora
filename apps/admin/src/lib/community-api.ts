"use client";

import { useAuth } from "@examora/auth-client";
import type {
  CommunityReport,
  CommunityReportStatus,
  ForumBoard,
  ForumCategory,
  PaginatedData,
  ThreadDetail,
  ThreadSummary,
} from "@examora/types";

/** Typed wrappers over the admin-facing Community & Discussion endpoints (ADR-0017). */
export function useCommunityAdminApi() {
  const { request } = useAuth();

  return {
    // Forum categories
    listCategories: () =>
      request<PaginatedData<ForumCategory>>("/admin/community/categories?pageSize=100", {
        method: "GET",
      }),
    createCategory: (body: { title: string; description?: string }) =>
      request<ForumCategory>("/admin/community/categories", { method: "POST", body }),
    updateCategory: (
      id: string,
      body: { title?: string; description?: string; isActive?: boolean },
    ) => request<ForumCategory>(`/admin/community/categories/${id}`, { method: "PATCH", body }),
    deleteCategory: (id: string) =>
      request<void>(`/admin/community/categories/${id}`, { method: "DELETE" }),

    // Forum boards
    listBoards: (categoryId?: string) =>
      request<PaginatedData<ForumBoard>>(
        `/admin/community/boards?pageSize=100${categoryId ? `&categoryId=${categoryId}` : ""}`,
        { method: "GET" },
      ),
    createBoard: (body: { categoryId: string; title: string; description?: string }) =>
      request<ForumBoard>("/admin/community/boards", { method: "POST", body }),
    updateBoard: (id: string, body: { title?: string; description?: string; isActive?: boolean }) =>
      request<ForumBoard>(`/admin/community/boards/${id}`, { method: "PATCH", body }),
    deleteBoard: (id: string) =>
      request<void>(`/admin/community/boards/${id}`, { method: "DELETE" }),

    // Moderation queue
    listReports: (status?: CommunityReportStatus) =>
      request<PaginatedData<CommunityReport>>(
        `/community/moderation/reports?pageSize=100${status ? `&status=${status}` : ""}`,
        { method: "GET" },
      ),
    reviewReport: (id: string, status: "REVIEWED" | "DISMISSED") =>
      request<CommunityReport>(`/community/moderation/reports/${id}`, {
        method: "PATCH",
        body: { status },
      }),

    // Thread moderation
    getThread: (id: string) => request<ThreadDetail>(`/community/threads/${id}`, { method: "GET" }),
    hideThread: (id: string, reason: string) =>
      request<ThreadDetail>(`/community/moderation/threads/${id}/hide`, {
        method: "POST",
        body: { reason },
      }),
    restoreThread: (id: string) =>
      request<ThreadDetail>(`/community/moderation/threads/${id}/restore`, { method: "POST" }),
    lockThread: (id: string) =>
      request<ThreadDetail>(`/community/moderation/threads/${id}/lock`, { method: "POST" }),
    unlockThread: (id: string) =>
      request<ThreadDetail>(`/community/moderation/threads/${id}/unlock`, { method: "POST" }),
    pinThread: (id: string) =>
      request<ThreadDetail>(`/community/moderation/threads/${id}/pin`, { method: "POST" }),
    unpinThread: (id: string) =>
      request<ThreadDetail>(`/community/moderation/threads/${id}/unpin`, { method: "POST" }),

    listAllThreads: (params?: { boardId?: string; page?: number; pageSize?: number }) =>
      request<PaginatedData<ThreadSummary>>(
        `/community/threads?pageSize=${params?.pageSize ?? 50}&page=${params?.page ?? 1}${
          params?.boardId ? `&boardId=${params.boardId}` : ""
        }`,
        { method: "GET" },
      ),
  };
}
