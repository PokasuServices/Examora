"use client";

import * as React from "react";
import type { Reply, ThreadDetail } from "@examora/types";
import { useCommunityApi } from "@/lib/community-api";

type LoadState = "loading" | "ready" | "not-found";

export function useThreadDetail(threadId: string) {
  const api = useCommunityApi();
  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [thread, setThread] = React.useState<ThreadDetail | null>(null);
  const [replies, setReplies] = React.useState<Reply[]>([]);
  const [postingReply, setPostingReply] = React.useState(false);

  const loadReplies = React.useCallback(() => {
    api
      .listReplies(threadId)
      .then((res) => setReplies(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const loadThread = React.useCallback(() => {
    api
      .getThread(threadId)
      .then((t) => {
        setThread(t);
        setLoadState("ready");
      })
      .catch(() => setLoadState("not-found"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  React.useEffect(() => {
    setLoadState("loading");
    loadThread();
    loadReplies();
  }, [loadThread, loadReplies]);

  async function postTopLevelReply(body: string): Promise<void> {
    setPostingReply(true);
    try {
      await api.createReply(threadId, body);
      loadReplies();
    } finally {
      setPostingReply(false);
    }
  }

  async function postNestedReply(parentReplyId: string, body: string): Promise<void> {
    await api.createReply(threadId, body, parentReplyId);
    loadReplies();
  }

  async function toggleReplyLike(replyId: string): Promise<void> {
    await api.toggleReplyLike(replyId);
    loadReplies();
  }

  async function acceptAnswer(replyId: string): Promise<void> {
    await api.acceptAnswer(threadId, replyId);
    loadThread();
    loadReplies();
  }

  async function unacceptAnswer(): Promise<void> {
    await api.unacceptAnswer(threadId);
    loadThread();
    loadReplies();
  }

  async function toggleThreadLike(): Promise<void> {
    await api.toggleThreadLike(threadId);
    loadThread();
  }

  async function toggleBookmark(): Promise<void> {
    await api.toggleBookmark(threadId);
    loadThread();
  }

  async function toggleFollow(): Promise<void> {
    await api.toggleFollow(threadId);
    loadThread();
  }

  async function toggleStatus(): Promise<void> {
    if (!thread) return;
    if (thread.status === "OPEN") await api.closeThread(threadId);
    else await api.reopenThread(threadId);
    loadThread();
  }

  async function updateThread(input: { title: string; body: string }): Promise<void> {
    await api.updateThread(threadId, input);
    loadThread();
  }

  async function deleteThread(): Promise<void> {
    await api.deleteThread(threadId);
  }

  async function reportThread(reason: string): Promise<void> {
    await api.reportContent("THREAD", threadId, reason);
  }

  async function reportReply(replyId: string, reason: string): Promise<void> {
    await api.reportContent("REPLY", replyId, reason);
  }

  return {
    loadState,
    thread,
    replies,
    postingReply,
    postTopLevelReply,
    postNestedReply,
    toggleReplyLike,
    acceptAnswer,
    unacceptAnswer,
    toggleThreadLike,
    toggleBookmark,
    toggleFollow,
    toggleStatus,
    updateThread,
    deleteThread,
    reportThread,
    reportReply,
  };
}
