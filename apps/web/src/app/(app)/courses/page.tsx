"use client";

import * as React from "react";
import { Filter } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { useCatalogData } from "@/components/courses/use-catalog-data";
import { CatalogCourseCard } from "@/components/courses/catalog-course-card";
import {
  CatalogFilterControls,
  CatalogSearchInput,
  type CatalogFiltersState,
} from "@/components/courses/catalog-filters";
import { FiltersSheet } from "@/components/courses/filters-sheet";
import { QuickActionsBar } from "@/components/courses/quick-actions-bar";
import { Pagination } from "@/components/ui/pagination";
import { CatalogCourseCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import type { SelectFieldOption } from "@/components/ui/select-field";
import type { EnrichedCourse, QuickFilter, SortOption } from "@/components/courses/types";

const PAGE_SIZE = 12;

const DEFAULT_FILTERS: CatalogFiltersState = {
  search: "",
  examType: "all",
  price: "all",
  status: "all",
  sort: "featured",
};

function matchesQuickFilter(entry: EnrichedCourse, quick: QuickFilter): boolean {
  switch (quick) {
    case "continue":
      return entry.status === "in-progress";
    case "recommended":
      return entry.recommendedReason !== null;
    case "recent":
      return entry.recentlyViewedAt !== null;
    case "all":
    default:
      return true;
  }
}

function matchesFilters(entry: EnrichedCourse, filters: CatalogFiltersState): boolean {
  const { course } = entry;
  if (filters.examType !== "all" && course.examType !== filters.examType) return false;
  if (filters.price === "free" && course.priceAmount !== null) return false;
  if (filters.price === "paid" && course.priceAmount === null) return false;

  if (
    filters.status === "purchased" &&
    !(course.priceAmount !== null && entry.status !== "locked")
  ) {
    return false;
  }
  if (filters.status === "in-progress" && entry.status !== "in-progress") return false;
  if (filters.status === "completed" && entry.status !== "completed") return false;
  if (filters.status === "not-started" && entry.status !== "not-started") return false;

  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    const haystack =
      `${course.title} ${course.description ?? ""} ${course.examType ?? ""}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function sortEntries(entries: EnrichedCourse[], sort: SortOption): EnrichedCourse[] {
  const sorted = [...entries];
  switch (sort) {
    case "title-asc":
      sorted.sort((a, b) => a.course.title.localeCompare(b.course.title));
      break;
    case "price-asc":
      sorted.sort((a, b) => (a.course.priceAmount ?? 0) - (b.course.priceAmount ?? 0));
      break;
    case "price-desc":
      sorted.sort((a, b) => (b.course.priceAmount ?? 0) - (a.course.priceAmount ?? 0));
      break;
    case "newest":
      sorted.sort((a, b) =>
        (b.course.publishedAt ?? b.course.createdAt).localeCompare(
          a.course.publishedAt ?? a.course.createdAt,
        ),
      );
      break;
    case "featured":
    default:
      // Server order already reflects admin-curated `position` — leave as-is.
      break;
  }
  return sorted;
}

function CatalogContent() {
  const data = useCatalogData();
  const [filters, setFilters] = React.useState<CatalogFiltersState>(DEFAULT_FILTERS);
  const [quickFilter, setQuickFilter] = React.useState<QuickFilter>("all");
  const [page, setPage] = React.useState(1);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const courses = React.useMemo(() => (data.status === "ready" ? data.courses : []), [data]);

  const examTypeOptions: SelectFieldOption[] = React.useMemo(() => {
    const distinct = Array.from(
      new Set(courses.map((e) => e.course.examType).filter((v): v is string => Boolean(v))),
    ).sort();
    return [
      { value: "all", label: "All exam types" },
      ...distinct.map((v) => ({ value: v, label: v })),
    ];
  }, [courses]);

  const filtered = React.useMemo(
    () =>
      sortEntries(
        courses.filter((e) => matchesQuickFilter(e, quickFilter) && matchesFilters(e, filters)),
        filters.sort,
      ),
    [courses, quickFilter, filters],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  React.useEffect(() => {
    setPage(1);
  }, [filters, quickFilter]);

  function handleFilterChange<K extends keyof CatalogFiltersState>(
    key: K,
    value: CatalogFiltersState[K],
  ) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function handleClear() {
    setFilters(DEFAULT_FILTERS);
    setQuickFilter("all");
  }

  const hasActiveFilters =
    filters.search !== "" ||
    filters.examType !== "all" ||
    filters.price !== "all" ||
    filters.status !== "all" ||
    filters.sort !== "featured";
  const activeFilterCount = [
    filters.examType !== "all",
    filters.price !== "all",
    filters.status !== "all",
  ].filter(Boolean).length;

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
          Course catalog
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Browse every published course — see what&rsquo;s free, what you own, and what&rsquo;s next
          to finish.
        </p>
      </div>

      <QuickActionsBar value={quickFilter} onChange={setQuickFilter} />

      {/* Desktop / tablet: search + filters always visible inline */}
      <div className="hidden flex-col gap-4 lg:flex">
        <CatalogSearchInput
          value={filters.search}
          onChange={(v) => handleFilterChange("search", v)}
        />
        <CatalogFilterControls
          state={filters}
          examTypeOptions={examTypeOptions}
          onChange={handleFilterChange}
          onClear={handleClear}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      {/* Mobile: search inline, filters collapse into a slide-over */}
      <div className="flex items-center gap-2 lg:hidden">
        <CatalogSearchInput
          id="catalog-search-mobile"
          value={filters.search}
          onChange={(v) => handleFilterChange("search", v)}
        />
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          className="relative flex h-11 shrink-0 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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
      <FiltersSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <CatalogFilterControls
          state={filters}
          examTypeOptions={examTypeOptions}
          onChange={handleFilterChange}
          onClear={handleClear}
          hasActiveFilters={hasActiveFilters}
        />
      </FiltersSheet>

      {data.status === "loading" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CatalogCourseCardSkeleton key={i} />
          ))}
        </div>
      ) : data.status === "error" ? (
        <RetryInline message="Couldn't load the course catalog" onRetry={data.retry} />
      ) : courses.length === 0 ? (
        <EmptyState
          heading="No courses published yet"
          body="Check back soon — new courses are added regularly."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          heading="No courses match your filters"
          body="Try a different search, or clear your filters to see everything."
          actionLabel="Clear filters"
          onAction={handleClear}
        />
      ) : (
        <>
          <p className="text-sm text-neutral-500" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? "course" : "courses"}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pageItems.map((entry) => (
              <CatalogCourseCard key={entry.course.id} entry={entry} />
            ))}
          </div>
          <Pagination page={clampedPage} pageCount={pageCount} onChange={setPage} />
        </>
      )}
    </main>
  );
}

export default function CatalogPage() {
  return (
    <RequireAuth>
      <CatalogContent />
    </RequireAuth>
  );
}
