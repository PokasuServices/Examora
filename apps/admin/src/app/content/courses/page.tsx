"use client";

import * as React from "react";
import Link from "next/link";
import { ApiError } from "@examora/auth-client";
import type { Category, ContentStatus, Course } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/commerce-api";
import { useContentApi } from "@/lib/content-api";

const STATUS_FILTERS: (ContentStatus | "ALL")[] = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"];

function CoursesContent() {
  const api = useContentApi();
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [filter, setFilter] = React.useState<ContentStatus | "ALL">("ALL");
  const [title, setTitle] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [examType, setExamType] = React.useState("");
  const [priceAmount, setPriceAmount] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .listCourses(filter === "ALL" ? undefined : { status: filter })
      .then((res) => setCourses(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    api
      .listCategories()
      .then((res) => setCategories(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await api.createCourse({
        title,
        categoryId: categoryId || undefined,
        examType: examType || undefined,
        priceAmount: priceAmount ? Number(priceAmount) : undefined,
      });
      setTitle("");
      setExamType("");
      setPriceAmount("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create course");
    }
  }

  const categoryName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? "—") : "—";

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Courses</h1>
        <Link href="/content/categories">
          <Button variant="secondary">Manage categories</Button>
        </Link>
      </div>

      <form
        onSubmit={create}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Course title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="examType">Exam type</Label>
          <Input id="examType" value={examType} onChange={(e) => setExamType(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="priceAmount">Price (INR, blank = free)</Label>
          <Input
            id="priceAmount"
            type="number"
            min="0"
            step="0.01"
            value={priceAmount}
            onChange={(e) => setPriceAmount(e.target.value)}
            className="w-32"
          />
        </div>
        <Button type="submit">Create course</Button>
      </form>
      <FieldError>{error}</FieldError>

      <div className="mt-6 flex gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-md px-3 py-1 text-sm ${
              filter === s ? "bg-primary-600 text-white" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Exam</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/content/courses/${course.id}`}
                    className="text-primary-600 hover:underline"
                  >
                    {course.title}
                  </Link>
                </td>
                <td className="px-4 py-3">{categoryName(course.categoryId)}</td>
                <td className="px-4 py-3">{course.examType ?? "—"}</td>
                <td className="px-4 py-3">
                  {course.priceAmount === null
                    ? "Free"
                    : formatMoney(course.priceAmount, course.priceCurrency)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={course.status} />
                </td>
              </tr>
            ))}
            {courses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No courses.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function CoursesPage() {
  return (
    <RequirePermission permission="content:manage">
      <CoursesContent />
    </RequirePermission>
  );
}
