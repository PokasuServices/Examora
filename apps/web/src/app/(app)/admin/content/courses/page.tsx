"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectField } from "@/components/ui/select-field";
import { Pagination } from "@/components/ui/pagination";
import { ContentShell } from "@/components/admin-content/content-shell";
import { CourseCreateForm } from "@/components/admin-content/course-create-form";
import { useCourses, type CourseStatusFilter } from "@/components/admin-content/use-courses";
import { contentStatusTone } from "@/components/admin-content/format";
import { statusLabel } from "@/components/orders/format";
import { formatMoney } from "@/lib/commerce-api";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
];

function CoursesContent() {
  const router = useRouter();
  const {
    status,
    courses,
    loadedCount,
    total,
    page,
    pageCount,
    setPage,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    categories,
    query,
    setQuery,
    mutationStatus,
    mutationError,
    createCourse,
    retry,
  } = useCourses();

  const [formOpen, setFormOpen] = React.useState(false);

  const categoryOptions = [
    { value: "ALL", label: "All categories" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  async function handleCreate(input: {
    title: string;
    categoryId?: string;
    examType?: string;
    description?: string;
  }): Promise<void> {
    const created = await createCourse(input);
    if (created) router.push(`/admin/content/courses/${created.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold text-neutral-900">Courses</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            {total.toLocaleString()} {total === 1 ? "course" : "courses"} across the platform.
          </p>
        </div>
        {!formOpen ? (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="flex h-10 items-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            New course
          </button>
        ) : null}
      </div>

      {formOpen ? (
        <CourseCreateForm
          categories={categories}
          submitting={mutationStatus === "submitting"}
          error={mutationError}
          onSubmit={(input) => void handleCreate(input)}
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
              placeholder="Search by title or slug…"
              className="h-10 w-full rounded-md border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            />
          </div>
          <div className="w-full sm:w-44">
            <SelectField
              id="course-status-filter"
              label="Status"
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={(v) => setStatusFilter(v as CourseStatusFilter)}
            />
          </div>
          <div className="w-full sm:w-48">
            <SelectField
              id="course-category-filter"
              label="Category"
              value={categoryFilter}
              options={categoryOptions}
              onChange={setCategoryFilter}
            />
          </div>
        </div>
        {loadedCount > 0 ? (
          <p className="mt-2 text-xs text-neutral-400">
            Search filters the {loadedCount} courses on this page — status and category filter the
            full course list on the backend.
          </p>
        ) : null}
      </Card>

      <Card density="compact" className="min-w-0">
        {status === "loading" ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : status === "error" ? (
          <RetryInline message="Couldn't load courses" onRetry={retry} />
        ) : courses.length === 0 ? (
          <EmptyState heading="No courses found" body="Try a different search or filter." />
        ) : (
          <>
            <div className="overflow-x-auto contain-layout">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Title
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Exam type
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Price
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Status
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Updated
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {courses.map((course) => (
                    <tr key={course.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <p className="max-w-xs truncate font-medium text-neutral-800">
                          {course.title}
                        </p>
                        <p className="truncate font-mono text-xs text-neutral-500">{course.slug}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                        {course.examType ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                        {course.priceAmount !== null
                          ? formatMoney(course.priceAmount, course.priceCurrency)
                          : "Free"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Chip tone={contentStatusTone(course.status)}>
                          {statusLabel(course.status)}
                        </Chip>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                        {new Date(course.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={`/admin/content/courses/${course.id}`}
                          className="text-sm font-medium text-primary-600 hover:underline"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 p-4">
              <p className="text-xs text-neutral-500">
                Page {page} of {pageCount}
              </p>
              <Pagination page={page} pageCount={pageCount} onChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export default function CoursesPage() {
  return (
    <RequirePermission permission="content:manage">
      <ContentShell>
        <CoursesContent />
      </ContentShell>
    </RequirePermission>
  );
}
