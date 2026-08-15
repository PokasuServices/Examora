"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { Category, ContentStatus, Course } from "@examora/types";
import { useContentApi } from "@/lib/content-api";

type Status = "loading" | "ready" | "error";
export type CourseStatusFilter = "ALL" | ContentStatus;
type MutationStatus = "idle" | "submitting" | "error";

const PAGE_SIZE = 15;

export function useCourses() {
  const api = useContentApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [courses, setCourses] = React.useState<Course[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<CourseStatusFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL");
  const [query, setQuery] = React.useState("");
  const [categories, setCategories] = React.useState<Category[]>([]);

  const [mutationStatus, setMutationStatus] = React.useState<MutationStatus>("idle");
  const [mutationError, setMutationError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .listCategories({ pageSize: 100 })
      .then((res) => setCategories(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listCourses({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        categoryId: categoryFilter === "ALL" ? undefined : categoryFilter,
      })
      .then((res) => {
        setCourses(res.items);
        setTotal(res.total);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, categoryFilter]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [statusFilter, categoryFilter]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return courses;
    const q = query.trim().toLowerCase();
    return courses.filter(
      (c) => c.title.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    );
  }, [courses, query]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function createCourse(input: {
    title: string;
    categoryId?: string;
    examType?: string;
    description?: string;
  }): Promise<Course | null> {
    setMutationStatus("submitting");
    setMutationError(null);
    try {
      const created = await api.createCourse(input);
      setMutationStatus("idle");
      load();
      return created;
    } catch (err) {
      setMutationStatus("error");
      setMutationError(err instanceof ApiError ? err.message : "Could not create course.");
      return null;
    }
  }

  async function setCourseStatus(id: string, newStatus: ContentStatus): Promise<boolean> {
    try {
      await api.setCourseStatus(id, newStatus);
      load();
      return true;
    } catch {
      return false;
    }
  }

  return {
    status,
    courses: filtered,
    loadedCount: courses.length,
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
    setCourseStatus,
    retry: load,
  };
}
