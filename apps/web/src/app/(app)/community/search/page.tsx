"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search as SearchIcon, X } from "lucide-react";
import type { ForumBoard, ThreadSummary, ThreadType } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Pagination } from "@/components/ui/pagination";
import { SelectField, type SelectFieldOption } from "@/components/ui/select-field";
import { ThreadCard } from "@/components/community/thread-card";
import { ThreadCardSkeletonList } from "@/components/community/skeletons";
import { useCommunityApi } from "@/lib/community-api";

const RECENT_SEARCHES_KEY = "examora.community.recentSearches";
const TYPE_OPTIONS: SelectFieldOption[] = [
  { value: "all", label: "All types" },
  { value: "DISCUSSION", label: "Discussions" },
  { value: "QUESTION", label: "Questions" },
];

function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string): string[] {
  const next = [query, ...loadRecentSearches().filter((q) => q !== query)].slice(0, 8);
  window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  return next;
}

type Status = "idle" | "loading" | "ready" | "error";

function CommunitySearchContent() {
  const api = useCommunityApi();
  const initialQuery = useSearchParams().get("q") ?? "";

  const [query, setQuery] = React.useState(initialQuery);
  const [boardId, setBoardId] = React.useState("all");
  const [type, setType] = React.useState<ThreadType | "all">("all");
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState<Status>("idle");
  const [results, setResults] = React.useState<ThreadSummary[]>([]);
  const [total, setTotal] = React.useState(0);
  const [recent, setRecent] = React.useState<string[]>([]);
  const [boards, setBoards] = React.useState<ForumBoard[]>([]);

  React.useEffect(() => {
    setRecent(loadRecentSearches());
    api
      .listBoards()
      .then((res) => setBoards(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = React.useCallback(
    (q: string, pageArg: number) => {
      if (q.trim().length < 2) {
        setStatus("idle");
        return;
      }
      setStatus("loading");
      api
        .search(q.trim(), {
          boardId: boardId === "all" ? undefined : boardId,
          type: type === "all" ? undefined : type,
          page: pageArg,
          pageSize: 15,
        })
        .then((res) => {
          setResults(res.items);
          setTotal(res.total);
          setStatus("ready");
        })
        .catch(() => setStatus("error"));
    },
    // api (useCommunityApi()) is a fresh object every render — never put it in a dependency array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardId, type],
  );

  React.useEffect(() => {
    if (initialQuery.trim().length >= 2) runSearch(initialQuery, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setPage(1);
    setRecent(saveRecentSearch(query.trim()));
    runSearch(query, 1);
  }

  function handlePageChange(next: number): void {
    setPage(next);
    runSearch(query, next);
  }

  const boardOptions: SelectFieldOption[] = [
    { value: "all", label: "All boards" },
    ...boards.map((b) => ({ value: b.id, label: `${b.categoryTitle} / ${b.title}` })),
  ];

  const pageCount = Math.max(1, Math.ceil(total / 15));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
        <Link href="/community" className="hover:text-primary-600 hover:underline">
          Community
        </Link>
      </nav>

      <div>
        <h1 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">Search</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Search discussion titles and bodies across the whole community.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <SearchIcon
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          />
          <label htmlFor="search-q" className="sr-only">
            Search query
          </label>
          <input
            id="search-q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            minLength={2}
            placeholder="Search by keyword… (at least 2 characters)"
            className="h-11 w-full rounded-md border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          />
        </div>

        {recent.length > 0 && query.trim().length === 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-neutral-400">Recent:</span>
            {recent.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setQuery(q);
                  setPage(1);
                  runSearch(q, 1);
                }}
                className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-200"
              >
                {q}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                window.localStorage.removeItem(RECENT_SEARCHES_KEY);
                setRecent([]);
              }}
              aria-label="Clear recent searches"
              className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <SelectField
            id="search-board"
            label="Board"
            value={boardId}
            options={boardOptions}
            onChange={setBoardId}
          />
          <SelectField
            id="search-type"
            label="Type"
            value={type}
            options={TYPE_OPTIONS}
            onChange={(v) => setType(v as ThreadType | "all")}
          />
          <div className="flex items-end">
            <button
              type="submit"
              disabled={query.trim().length < 2}
              className="flex h-10 w-full items-center justify-center rounded-md bg-primary-600 px-5 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60 sm:w-auto"
            >
              Search
            </button>
          </div>
        </div>
      </form>

      {status === "loading" ? (
        <ThreadCardSkeletonList count={5} />
      ) : status === "error" ? (
        <RetryInline message="Search failed" onRetry={() => runSearch(query, page)} />
      ) : status === "ready" && results.length === 0 ? (
        <EmptyState heading="No results" body={`Nothing matched "${query}".`} />
      ) : status === "ready" ? (
        <>
          <p className="text-sm text-neutral-500" aria-live="polite">
            {total} {total === 1 ? "result" : "results"}
          </p>
          <div className="flex flex-col gap-3">
            {results.map((thread) => (
              <ThreadCard key={thread.id} thread={thread} />
            ))}
          </div>
          <Pagination page={page} pageCount={pageCount} onChange={handlePageChange} />
        </>
      ) : null}
    </main>
  );
}

export default function CommunitySearchPage() {
  return (
    <RequireAuth>
      <React.Suspense fallback={null}>
        <CommunitySearchContent />
      </React.Suspense>
    </RequireAuth>
  );
}
