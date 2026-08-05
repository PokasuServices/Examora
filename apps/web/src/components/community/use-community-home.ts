"use client";

import * as React from "react";
import type { ForumBoard, ForumCategory, ThreadSummary } from "@examora/types";
import { useCommunityApi } from "@/lib/community-api";

type Status = "loading" | "ready" | "error";

/**
 * Community Home data: real categories/boards for the directory, plus one
 * pageSize=30 cross-board fetch of the newest threads (server order:
 * pinned-first, then createdAt desc) that both the "Recent" rail (as
 * returned) and the "Trending" rail (re-sorted client-side by real
 * likeCount+replyCount) are derived from — no fabricated trending signal,
 * no separate global "activity feed" endpoint exists so there is no
 * distinct "Latest Activity" section beyond Recent (see report).
 */
export function useCommunityHome() {
  const api = useCommunityApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [categories, setCategories] = React.useState<ForumCategory[]>([]);
  const [boardsByCategory, setBoardsByCategory] = React.useState<Record<string, ForumBoard[]>>({});
  const [recentThreads, setRecentThreads] = React.useState<ThreadSummary[]>([]);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    setStatus("loading");
    Promise.all([
      api.listCategories().then((res) => setCategories(res.items)),
      // One request for every board, grouped client-side by ForumBoard.categoryId
      // — firing one listBoards(categoryId) call per category (as this used to)
      // is an N+1 pattern that trips the API's per-minute rate limit once a
      // handful of categories exist (found live during E2E verification).
      api.listBoards().then((res) => {
        const grouped: Record<string, ForumBoard[]> = {};
        for (const board of res.items) {
          (grouped[board.categoryId] ??= []).push(board);
        }
        setBoardsByCategory(grouped);
      }),
      api.listThreads({ page: 1, pageSize: 30 }).then((res) => setRecentThreads(res.items)),
    ])
      .then(() => setStatus("ready"))
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const trending = React.useMemo(
    () =>
      [...recentThreads]
        .filter((t) => !t.isPinned)
        .sort((a, b) => b.likeCount * 2 + b.replyCount - (a.likeCount * 2 + a.replyCount))
        .slice(0, 6),
    [recentThreads],
  );

  const totalThreads = React.useMemo(
    () =>
      Object.values(boardsByCategory)
        .flat()
        .reduce((sum, b) => sum + b.threadCount, 0),
    [boardsByCategory],
  );

  return {
    status,
    categories,
    boardsByCategory,
    recentThreads: recentThreads.slice(0, 8),
    trending,
    totalThreads,
    boardCount: Object.values(boardsByCategory).flat().length,
    retry: () => setAttempt((a) => a + 1),
  };
}
