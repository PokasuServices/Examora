"use client";

import { useAuth } from "@examora/auth-client";
import type {
  Category,
  ContentStatus,
  Course,
  Lesson,
  Module,
  PaginatedData,
  Subject,
  Topic,
} from "@examora/types";

const BASE = "/admin/content";

/** Thin, typed wrappers over the authenticated request helper for content endpoints. */
export function useContentApi() {
  const { request } = useAuth();

  return {
    // Categories
    listCategories: () =>
      request<PaginatedData<Category>>(`${BASE}/categories?pageSize=100`, { method: "GET" }),
    createCategory: (body: { name: string; description?: string }) =>
      request<Category>(`${BASE}/categories`, { method: "POST", body }),
    updateCategory: (
      id: string,
      body: Partial<{ name: string; description: string; isActive: boolean }>,
    ) => request<Category>(`${BASE}/categories/${id}`, { method: "PATCH", body }),
    deleteCategory: (id: string) => request<void>(`${BASE}/categories/${id}`, { method: "DELETE" }),

    // Courses
    listCourses: (params?: { status?: ContentStatus; categoryId?: string }) => {
      const qs = new URLSearchParams({ pageSize: "100" });
      if (params?.status) qs.set("status", params.status);
      if (params?.categoryId) qs.set("categoryId", params.categoryId);
      return request<PaginatedData<Course>>(`${BASE}/courses?${qs.toString()}`, { method: "GET" });
    },
    getCourse: (id: string) => request<Course>(`${BASE}/courses/${id}`, { method: "GET" }),
    createCourse: (body: {
      title: string;
      categoryId?: string;
      examType?: string;
      description?: string;
    }) => request<Course>(`${BASE}/courses`, { method: "POST", body }),
    updateCourse: (
      id: string,
      body: Partial<{ title: string; description: string; examType: string; categoryId: string }>,
    ) => request<Course>(`${BASE}/courses/${id}`, { method: "PATCH", body }),
    setCourseStatus: (id: string, status: ContentStatus) =>
      request<Course>(`${BASE}/courses/${id}/status`, { method: "PATCH", body: { status } }),
    deleteCourse: (id: string) => request<void>(`${BASE}/courses/${id}`, { method: "DELETE" }),

    // Nested nodes (subjects/topics/modules/lessons) share a shape.
    listNodes: <T>(collection: string, parentKey: string, parentId: string) =>
      request<PaginatedData<T>>(`${BASE}/${collection}?${parentKey}=${parentId}&pageSize=100`, {
        method: "GET",
      }),
    createNode: <T>(collection: string, body: Record<string, unknown>) =>
      request<T>(`${BASE}/${collection}`, { method: "POST", body }),
    updateNode: <T>(collection: string, id: string, body: Record<string, unknown>) =>
      request<T>(`${BASE}/${collection}/${id}`, { method: "PATCH", body }),
    setNodeStatus: <T>(collection: string, id: string, status: ContentStatus) =>
      request<T>(`${BASE}/${collection}/${id}/status`, { method: "PATCH", body: { status } }),
    deleteNode: (collection: string, id: string) =>
      request<void>(`${BASE}/${collection}/${id}`, { method: "DELETE" }),
  };
}

export type { Category, Course, Subject, Topic, Module, Lesson };
