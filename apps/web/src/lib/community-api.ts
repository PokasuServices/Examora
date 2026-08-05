"use client";

import { useAuth } from "@examora/auth-client";
import type {
  BookmarkToggleResult,
  CommunityActivityItem,
  CommunityAttachment,
  CommunityProfileSummary,
  CommunityTargetType,
  FollowToggleResult,
  ForumBoard,
  ForumCategory,
  LikeToggleResult,
  PaginatedData,
  PresignedUpload,
  Reply,
  ReputationEventItem,
  ThreadDetail,
  ThreadStatus,
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
    getCategory: (categoryId: string) =>
      request<ForumCategory>(`/community/categories/${categoryId}`, { method: "GET" }),

    listThreads: (params: {
      boardId?: string;
      type?: ThreadType;
      status?: ThreadStatus;
      solved?: boolean;
      authorId?: string;
      page?: number;
      pageSize?: number;
    }) => {
      const qs = new URLSearchParams({
        pageSize: String(params.pageSize ?? 20),
        page: String(params.page ?? 1),
      });
      if (params.boardId) qs.set("boardId", params.boardId);
      if (params.type) qs.set("type", params.type);
      if (params.status) qs.set("status", params.status);
      if (params.solved !== undefined) qs.set("solved", String(params.solved));
      if (params.authorId) qs.set("authorId", params.authorId);
      return request<PaginatedData<ThreadSummary>>(`/community/threads?${qs.toString()}`, {
        method: "GET",
      });
    },
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
    getReputationEvents: (userId: string) =>
      request<PaginatedData<ReputationEventItem>>(`/community/reputation/${userId}/events`, {
        method: "GET",
      }),
    getActivity: (userId: string) =>
      request<CommunityActivityItem[]>(`/community/activity/${userId}`, { method: "GET" }),

    search: (
      q: string,
      params?: { boardId?: string; type?: ThreadType; page?: number; pageSize?: number },
    ) => {
      const qs = new URLSearchParams({
        q,
        pageSize: String(params?.pageSize ?? 20),
        page: String(params?.page ?? 1),
      });
      if (params?.boardId) qs.set("boardId", params.boardId);
      if (params?.type) qs.set("type", params.type);
      return request<PaginatedData<ThreadSummary>>(`/community/search?${qs.toString()}`, {
        method: "GET",
      });
    },

    reportContent: (targetType: "THREAD" | "REPLY", targetId: string, reason: string) =>
      request<void>("/community/reports", {
        method: "POST",
        body: { targetType, targetId, reason },
      }),

    presignAttachment: (body: {
      targetType: CommunityTargetType;
      targetId: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    }) => request<PresignedUpload>("/community/attachments/presign", { method: "POST", body }),
    /** Same direct-to-storage XHR PUT with progress used by the Assignment Workspace uploader. */
    uploadToPresignedUrlWithProgress: (
      url: string,
      file: File,
      onProgress: (percent: number) => void,
    ): Promise<void> =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      }),
    confirmAttachment: (body: {
      targetType: CommunityTargetType;
      targetId: string;
      storageKey: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    }) => request<CommunityAttachment>("/community/attachments/confirm", { method: "POST", body }),
    listAttachments: (targetType: CommunityTargetType, targetId: string) =>
      request<CommunityAttachment[]>(
        `/community/attachments?targetType=${targetType}&targetId=${targetId}`,
        { method: "GET" },
      ),
    getAttachmentDownloadUrl: (attachmentId: string) =>
      request<{ url: string }>(`/community/attachments/${attachmentId}/download-url`, {
        method: "GET",
      }),
    deleteAttachment: (attachmentId: string) =>
      request<void>(`/community/attachments/${attachmentId}`, { method: "DELETE" }),
  };
}
