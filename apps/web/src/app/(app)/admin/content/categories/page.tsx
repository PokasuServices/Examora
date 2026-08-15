"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Search } from "lucide-react";
import type { Category } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectField } from "@/components/ui/select-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ContentShell } from "@/components/admin-content/content-shell";
import { CategoryForm } from "@/components/admin-content/category-form";
import { useCategories, type ActiveFilter } from "@/components/admin-content/use-categories";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All categories" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

function CategoriesContent() {
  const {
    status,
    categories,
    loadedCount,
    activeFilter,
    setActiveFilter,
    query,
    setQuery,
    mutationStatus,
    mutationError,
    createCategory,
    updateCategory,
    toggleActive,
    deleteCategory,
    move,
    retry,
  } = useCategories();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [deleting, setDeleting] = React.useState<Category | null>(null);

  function openCreate(): void {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(category: Category): void {
    setEditing(category);
    setFormOpen(true);
  }

  async function handleSubmit(input: {
    name: string;
    slug?: string;
    description?: string;
  }): Promise<void> {
    const ok = editing ? await updateCategory(editing.id, input) : await createCategory(input);
    if (ok) setFormOpen(false);
  }

  async function confirmDelete(): Promise<void> {
    if (!deleting) return;
    const ok = await deleteCategory(deleting.id);
    if (ok) setDeleting(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold text-neutral-900">Categories</h2>
          <p className="mt-0.5 text-sm text-neutral-500">Group courses by subject area.</p>
        </div>
        {!formOpen ? (
          <button
            type="button"
            onClick={openCreate}
            className="flex h-10 items-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            New category
          </button>
        ) : null}
      </div>

      {formOpen ? (
        <CategoryForm
          editing={editing}
          submitting={mutationStatus === "submitting"}
          error={mutationError}
          onSubmit={(input) => void handleSubmit(input)}
          onCancel={() => setFormOpen(false)}
        />
      ) : null}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative flex-1">
            <Search
              size={16}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or slug…"
              className="h-10 w-full rounded-md border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            />
          </div>
          <div className="w-full sm:w-48">
            <SelectField
              id="category-active-filter"
              label="Status"
              value={activeFilter}
              options={STATUS_OPTIONS}
              onChange={(v) => setActiveFilter(v as ActiveFilter)}
            />
          </div>
        </div>
        {loadedCount > 0 ? (
          <p className="mt-2 text-xs text-neutral-400">
            Search filters the {loadedCount} loaded categories — status filtering queries the
            backend directly.
          </p>
        ) : null}
      </Card>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load categories" onRetry={retry} />
        ) : categories.length === 0 ? (
          <EmptyState
            heading="No categories found"
            body="Create the first category to get started."
          />
        ) : (
          <div className="overflow-x-auto contain-layout">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Name
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Slug
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Order
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {categories.map((category, i) => (
                  <tr key={category.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-800">{category.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-neutral-500">
                      {category.slug}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button type="button" onClick={() => void toggleActive(category)}>
                        <Chip tone={category.isActive ? "success" : "neutral"}>
                          {category.isActive ? "Active" : "Inactive"}
                        </Chip>
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Move ${category.name} up`}
                          disabled={i === 0}
                          onClick={() => void move(category, "up")}
                          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:pointer-events-none disabled:opacity-30"
                        >
                          <ArrowUp size={14} strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${category.name} down`}
                          disabled={i === categories.length - 1}
                          onClick={() => void move(category, "down")}
                          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:pointer-events-none disabled:opacity-30"
                        >
                          <ArrowDown size={14} strokeWidth={2} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openEdit(category)}
                          className="text-sm font-medium text-primary-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(category)}
                          className="text-sm font-medium text-danger-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete category?"
        message={
          deleting ? (
            <>
              Delete <span className="font-medium text-neutral-800">{deleting.name}</span>? This
              can&rsquo;t be undone.
            </>
          ) : null
        }
        confirmLabel="Delete"
        tone="danger"
        submitting={mutationStatus === "submitting"}
        error={mutationError}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <RequirePermission permission="content:manage">
      <ContentShell>
        <CategoriesContent />
      </ContentShell>
    </RequirePermission>
  );
}
