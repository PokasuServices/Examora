"use client";

import { useAuth } from "@examora/auth-client";
import type {
  BookmarkToggleResult,
  CommunityActivityItem,
  CommunityProfileSummary,
  FollowToggleResult,
  ForumBoard,
  ForumCategory,
  LikeToggleResult,
  PaginatedData,
  Reply,
  ThreadDetail,
  ThreadSummary,
  ThreadType,
} from "@examora/types";

/** Typed wrappers over the student-facing Community & Discussion endpoints (ADR-0017). */
export function useCommunityApi() {
  const { request } = useAuth();

  return {
    listCategories: () =>
      request<PaginatedData<ForumCategory>>("/community/categories?pageSize=100", {
        method: "GET",
      }),
    listBoards: (categoryId?: string) =>
      request<PaginatedData<ForumBoard>>(
        `/community/boards?pageSize=100${categoryId ? `&categoryId=${categoryId}` : ""}`,
        { method: "GET" },
      ),
    getBoard: (boardId: string) =>
      request<ForumBoard>(`/community/boards/${boardId}`, { method: "GET" }),

    listThreads: (params: { boardId?: string; page?: number; pageSize?: number }) =>
      request<PaginatedData<ThreadSummary>>(
        `/community/threads?pageSize=${params.pageSize ?? 20}&page=${params.page ?? 1}${
          params.boardId ? `&boardId=${params.boardId}` : ""
        }`,
        { method: "GET" },
      ),
    getThread: (id: string) => request<ThreadDetail>(`/community/threads/${id}`, { method: "GET" }),
    createThread: (body: { boardId: string; type?: ThreadType; title: string; body: string }) =>
      request<ThreadDetail>("/community/threads", { method: "POST", body }),
    updateThread: (id: string, body: { title?: string; body?: string }) =>
      request<ThreadDetail>(`/community/threads/${id}`, { method: "PATCH", body }),
    deleteThread: (id: string) => request<void>(`/community/threads/${id}`, { method: "DELETE" }),
    closeThread: (id: string) =>
      request<ThreadDetail>(`/community/threads/${id}/close`, { method: "POST" }),
    reopenThread: (id: string) =>
      request<ThreadDetail>(`/community/threads/${id}/reopen`, { method: "POST" }),
    acceptAnswer: (threadId: string, replyId: string) =>
      request<ThreadDetail>(`/community/threads/${threadId}/accept-answer`, {
        method: "POST",
        body: { replyId },
      }),
    unacceptAnswer: (threadId: string) =>
      request<ThreadDetail>(`/community/threads/${threadId}/unaccept-answer`, { method: "POST" }),

    listReplies: (threadId: string) =>
      request<PaginatedData<Reply>>(`/community/threads/${threadId}/replies?pageSize=100`, {
        method: "GET",
      }),
    createReply: (threadId: string, body: string, parentReplyId?: string) =>
      request<Reply>(`/community/threads/${threadId}/replies`, {
        method: "POST",
        body: { body, ...(parentReplyId ? { parentReplyId } : {}) },
      }),
    updateReply: (replyId: string, body: string) =>
      request<Reply>(`/community/replies/${replyId}`, { method: "PATCH", body: { body } }),
    deleteReply: (replyId: string) =>
      request<void>(`/community/replies/${replyId}`, { method: "DELETE" }),

    toggleThreadLike: (threadId: string) =>
      request<LikeToggleResult>(`/community/threads/${threadId}/like`, { method: "POST" }),
    toggleReplyLike: (replyId: string) =>
      request<LikeToggleResult>(`/community/replies/${replyId}/like`, { method: "POST" }),
    toggleBookmark: (threadId: string) =>
      request<BookmarkToggleResult>(`/community/threads/${threadId}/bookmark`, { method: "POST" }),
    toggleFollow: (threadId: string) =>
      request<FollowToggleResult>(`/community/threads/${threadId}/follow`, { method: "POST" }),
    listBookmarks: () =>
      request<PaginatedData<ThreadSummary>>("/community/bookmarks?pageSize=100", { method: "GET" }),

    getReputation: (userId: string) =>
      request<CommunityProfileSummary>(`/community/reputation/${userId}`, { method: "GET" }),
    getActivity: (userId: string) =>
      request<CommunityActivityItem[]>(`/community/activity/${userId}`, { method: "GET" }),

    search: (q: string, params?: { boardId?: string; type?: ThreadType }) =>
      request<PaginatedData<ThreadSummary>>(
        `/community/search?q=${encodeURIComponent(q)}&pageSize=50${
          params?.boardId ? `&boardId=${params.boardId}` : ""
        }${params?.type ? `&type=${params.type}` : ""}`,
        { method: "GET" },
      ),

    reportContent: (targetType: "THREAD" | "REPLY", targetId: string, reason: string) =>
      request<void>("/community/reports", {
        method: "POST",
        body: { targetType, targetId, reason },
      }),
  };
}
