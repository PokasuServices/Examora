"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectField } from "@/components/ui/select-field";
import { Pagination } from "@/components/ui/pagination";
import { CmsShell } from "@/components/admin-cms/cms-shell";
import type { CmsStatusFilter } from "./use-cms-list";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "APPROVED", label: "Approved" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
];

export function CmsListPageShell({
  heading,
  subtitle,
  status,
  total,
  isEmpty,
  page,
  pageCount,
  setPage,
  statusFilter,
  setStatusFilter,
  onRetry,
  createForm,
  formOpen,
  onOpenCreate,
  table,
}: {
  heading: string;
  subtitle: string;
  status: "loading" | "ready" | "error";
  total: number;
  isEmpty: boolean;
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
  statusFilter: CmsStatusFilter;
  setStatusFilter: (status: CmsStatusFilter) => void;
  onRetry: () => void;
  createForm: React.ReactNode;
  formOpen: boolean;
  onOpenCreate: () => void;
  table: React.ReactNode;
}) {
  return (
    <CmsShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold text-neutral-900">{heading}</h2>
            <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>
          </div>
          {!formOpen ? (
            <button
              type="button"
              onClick={onOpenCreate}
              className="flex h-10 items-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              New
            </button>
          ) : null}
        </div>

        {formOpen ? createForm : null}

        <Card>
          <div className="w-full sm:w-56">
            <SelectField
              id={`${heading}-status-filter`}
              label="Status"
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={(v) => setStatusFilter(v as CmsStatusFilter)}
            />
          </div>
        </Card>

        <Card density="compact" className="min-w-0">
          {status === "loading" ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : status === "error" ? (
            <RetryInline message={`Couldn't load ${heading.toLowerCase()}`} onRetry={onRetry} />
          ) : isEmpty ? (
            <EmptyState
              heading={`No ${heading.toLowerCase()} yet`}
              body="Create the first one to get started."
            />
          ) : (
            <>
              {table}
              <div className="flex items-center justify-between gap-3 p-4">
                <p className="text-xs text-neutral-500">
                  {total} {total === 1 ? "item" : "items"}
                </p>
                <Pagination page={page} pageCount={pageCount} onChange={setPage} />
              </div>
            </>
          )}
        </Card>
      </div>
    </CmsShell>
  );
}
