"use client";

import { Search, X } from "lucide-react";
import { SelectField, type SelectFieldOption } from "@/components/ui/select-field";
import type { PriceFilter, SortOption, StatusFilter } from "./types";

const PRICE_OPTIONS: SelectFieldOption[] = [
  { value: "all", label: "All prices" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

const STATUS_OPTIONS: SelectFieldOption[] = [
  { value: "all", label: "All courses" },
  { value: "purchased", label: "Purchased" },
  { value: "in-progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "not-started", label: "Not started" },
];

const SORT_OPTIONS: SelectFieldOption[] = [
  { value: "featured", label: "Featured" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "newest", label: "Newest first" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

export interface CatalogFiltersState {
  search: string;
  examType: string;
  price: PriceFilter;
  status: StatusFilter;
  sort: SortOption;
}

export function CatalogSearchInput({
  value,
  onChange,
  id = "catalog-search",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <div className="relative flex-1">
      <label htmlFor={id} className="sr-only">
        Search courses
      </label>
      <Search
        size={16}
        strokeWidth={1.75}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by course name, description, or exam type…"
        className="h-11 w-full rounded-md border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      />
    </div>
  );
}

/** The four filter selects + clear action — used both inline (desktop) and inside the mobile FiltersSheet. */
export function CatalogFilterControls({
  state,
  examTypeOptions,
  onChange,
  onClear,
  hasActiveFilters,
}: {
  state: CatalogFiltersState;
  examTypeOptions: SelectFieldOption[];
  onChange: <K extends keyof CatalogFiltersState>(key: K, value: CatalogFiltersState[K]) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SelectField
          id="filter-examtype"
          label="Exam type"
          value={state.examType}
          options={examTypeOptions}
          onChange={(v) => onChange("examType", v)}
        />
        <SelectField
          id="filter-price"
          label="Price"
          value={state.price}
          options={PRICE_OPTIONS}
          onChange={(v) => onChange("price", v as PriceFilter)}
        />
        <SelectField
          id="filter-status"
          label="Status"
          value={state.status}
          options={STATUS_OPTIONS}
          onChange={(v) => onChange("status", v as StatusFilter)}
        />
        <SelectField
          id="filter-sort"
          label="Sort by"
          value={state.sort}
          options={SORT_OPTIONS}
          onChange={(v) => onChange("sort", v as SortOption)}
        />
      </div>

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        >
          <X size={14} strokeWidth={2} aria-hidden="true" />
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
