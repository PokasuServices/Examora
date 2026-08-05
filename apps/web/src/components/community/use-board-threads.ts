"use client";

import * as React from "react";
import type { ForumBoard, ThreadSummary, ThreadType } from "@examora/types";
import { useCommunityApi } from "@/lib/community-api";

type Status = "loading" | "ready" | "error" | "not-found";
export type SortOption = "recent" | "most-liked" | "most-replies";

export interface BoardThreadFilters {
  search: string;
  type: ThreadType | "all";
  solved: "all" | "solved" | "unsolved";
  sort: SortOption;
}

export const DEFAULT_BOARD_FILTERS: BoardThreadFilters = {
  search: "",
  type: "all",
  solved: "all",
  sort: "recent",
};

/**
 * type/solved are real, server-supported ListThreadsQueryDto filters, so
 * they're sent to the API directly (re-fetching per combination). There is
 * no server-side sort-by-likes/replies or full-text search on this
 * endpoint, so — same pattern as the Course Catalog — up to 100 matching
 * threads are fetched once per filter combination and sort/title-search/
 * pagination happen client-side over that real, already-filtered set.
 */
export function useBoardThreads(boardId: string) {
  const api = useCommunityApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [board, setBoard] = React.useState<ForumBoard | null>(null);
  const [threads, setThreads] = React.useState<ThreadSummary[]>([]);
  const [filters, setFilters] = React.useState<BoardThreadFilters>(DEFAULT_BOARD_FILTERS);
  const [page, setPage] = React.useState(1);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .getBoard(boardId)
      .then(setBoard)
      .catch(() => setStatus("not-found"));
    api
      .listThreads({
        boardId,
        pageSize: 100,
        page: 1,
        type: filters.type === "all" ? undefined : filters.type,
        solved: filters.solved === "all" ? undefined : filters.solved === "solved",
      })
      .then((res) => {
        setThreads(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, filters.type, filters.solved]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [filters]);

  const filtered = React.useMemo(() => {
    let result = threads;
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }
    const sorted = [...result];
    switch (filters.sort) {
      case "most-liked":
        sorted.sort((a, b) => b.likeCount - a.likeCount);
        break;
      case "most-replies":
        sorted.sort((a, b) => b.replyCount - a.replyCount);
        break;
      case "recent":
      default:
        sorted.sort(
          (a, b) =>
            Number(b.isPinned) - Number(a.isPinned) || b.createdAt.localeCompare(a.createdAt),
        );
        break;
    }
    return sorted;
  }, [threads, filters.search, filters.sort]);

  const PAGE_SIZE = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  return {
    status,
    board,
    threads: filtered,
    pageItems,
    page: clampedPage,
    pageCount,
    setPage,
    filters,
    setFilters,
    retry: load,
  };
}
