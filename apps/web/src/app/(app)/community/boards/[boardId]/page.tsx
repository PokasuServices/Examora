"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Filter, MessagesSquare, PenSquare, Search } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField, type SelectFieldOption } from "@/components/ui/select-field";
import { FiltersSheet } from "@/components/courses/filters-sheet";
import { ThreadCard } from "@/components/community/thread-card";
import { ThreadCardSkeletonList } from "@/components/community/skeletons";
import {
  useBoardThreads,
  type BoardThreadFilters,
  type SortOption,
} from "@/components/community/use-board-threads";

const TYPE_OPTIONS: SelectFieldOption[] = [
  { value: "all", label: "All types" },
  { value: "DISCUSSION", label: "Discussions" },
  { value: "QUESTION", label: "Questions" },
];
const SOLVED_OPTIONS: SelectFieldOption[] = [
  { value: "all", label: "Any status" },
  { value: "solved", label: "Solved" },
  { value: "unsolved", label: "Unsolved" },
];
const SORT_OPTIONS: SelectFieldOption[] = [
  { value: "recent", label: "Most recent" },
  { value: "most-liked", label: "Most liked" },
  { value: "most-replies", label: "Most replies" },
];

function FilterControls({
  filters,
  onChange,
}: {
  filters: BoardThreadFilters;
  onChange: <K extends keyof BoardThreadFilters>(key: K, value: BoardThreadFilters[K]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <SelectField
        id="board-type-filter"
        label="Type"
        value={filters.type}
        options={TYPE_OPTIONS}
        onChange={(v) => onChange("type", v as BoardThreadFilters["type"])}
      />
      <SelectField
        id="board-solved-filter"
        label="Status"
        value={filters.solved}
        options={SOLVED_OPTIONS}
        onChange={(v) => onChange("solved", v as BoardThreadFilters["solved"])}
      />
      <SelectField
        id="board-sort"
        label="Sort by"
        value={filters.sort}
        options={SORT_OPTIONS}
        onChange={(v) => onChange("sort", v as SortOption)}
      />
    </div>
  );
}

function BoardThreadsContent() {
  const { boardId } = useParams<{ boardId: string }>();
  const data = useBoardThreads(boardId);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  function handleFilterChange<K extends keyof BoardThreadFilters>(
    key: K,
    value: BoardThreadFilters[K],
  ) {
    data.setFilters((f) => ({ ...f, [key]: value }));
  }

  const activeFilterCount = [data.filters.type !== "all", data.filters.solved !== "all"].filter(
    Boolean,
  ).length;

  if (data.status === "not-found") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <EmptyState
          heading="Board not found"
          body="This board may have been removed."
          actionLabel="Back to community"
          actionHref="/community"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
        <Link href="/community" className="hover:text-primary-600 hover:underline">
          Community
        </Link>
        {data.board ? <span> / {data.board.categoryTitle}</span> : null}
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {data.board?.title ?? "Board"}
          </h1>
          {data.board?.description ? (
            <p className="mt-1 max-w-2xl text-sm text-neutral-500">{data.board.description}</p>
          ) : null}
        </div>
        <Link
          href={`/community/boards/${boardId}/new`}
          className="flex h-11 shrink-0 items-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <PenSquare size={16} strokeWidth={1.75} aria-hidden="true" />
          New thread
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          />
          <label htmlFor="board-search" className="sr-only">
            Search this board
          </label>
          <input
            id="board-search"
            value={data.filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            placeholder="Search this board by title…"
            className="h-11 w-full rounded-md border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          className="relative flex h-11 shrink-0 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:hidden"
        >
          <Filter size={16} strokeWidth={1.75} aria-hidden="true" />
          Filters
          {activeFilterCount > 0 ? (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-semibold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      <div className="hidden lg:block">
        <FilterControls filters={data.filters} onChange={handleFilterChange} />
      </div>
      <FiltersSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        footerLabel="Show discussions"
      >
        <FilterControls filters={data.filters} onChange={handleFilterChange} />
      </FiltersSheet>

      {data.status === "loading" ? (
        <ThreadCardSkeletonList count={6} />
      ) : data.status === "error" ? (
        <RetryInline message="Couldn't load this board" onRetry={data.retry} />
      ) : data.threads.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          heading="No discussions match"
          body="Try a different search or filter, or start the first thread."
          actionLabel="New thread"
          actionHref={`/community/boards/${boardId}/new`}
        />
      ) : (
        <>
          <p className="text-sm text-neutral-500" aria-live="polite">
            {data.threads.length} {data.threads.length === 1 ? "discussion" : "discussions"}
          </p>
          <div className="flex flex-col gap-3">
            {data.pageItems.map((thread) => (
              <ThreadCard key={thread.id} thread={thread} showBoard={false} />
            ))}
          </div>
          <Pagination page={data.page} pageCount={data.pageCount} onChange={data.setPage} />
        </>
      )}
    </main>
  );
}

export default function BoardThreadsPage() {
  return (
    <RequireAuth>
      <BoardThreadsContent />
    </RequireAuth>
  );
}
