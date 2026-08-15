"use client";

import { useAuth } from "@examora/auth-client";
import type { Category, ContentStatus, Course, PaginatedData } from "@examora/types";

const BASE = "/admin/content";

/** Typed wrappers over the existing course-content hierarchy endpoints (content:manage / content:publish). No new backend routes. */
export function useContentApi() {
  const { request } = useAuth();

  return {
    // Categories — no search/course-count on the backend (see content.ts survey).
    listCategories: (params: { page?: number; pageSize?: number; isActive?: boolean } = {}) => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.pageSize) qs.set("pageSize", String(params.pageSize));
      if (params.isActive !== undefined) qs.set("isActive", String(params.isActive));
      return request<PaginatedData<Category>>(`${BASE}/categories?${qs.toString()}`, {
        method: "GET",
      });
    },
    createCategory: (body: {
      name: string;
      slug?: string;
      description?: string;
      position?: number;
    }) => request<Category>(`${BASE}/categories`, { method: "POST", body }),
    updateCategory: (
      id: string,
      body: Partial<{
        name: string;
        slug: string;
        description: string;
        isActive: boolean;
        position: number;
      }>,
    ) => request<Category>(`${BASE}/categories/${id}`, { method: "PATCH", body }),
    reorderCategories: (orderedIds: string[]) =>
      request<void>(`${BASE}/categories/reorder`, { method: "POST", body: { orderedIds } }),
    deleteCategory: (id: string) => request<void>(`${BASE}/categories/${id}`, { method: "DELETE" }),

    // Courses — real server-side pagination + status/categoryId/examType filters (no title search).
    listCourses: (
      params: {
        page?: number;
        pageSize?: number;
        status?: ContentStatus;
        categoryId?: string;
        examType?: string;
      } = {},
    ) => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.pageSize) qs.set("pageSize", String(params.pageSize));
      if (params.status) qs.set("status", params.status);
      if (params.categoryId) qs.set("categoryId", params.categoryId);
      if (params.examType) qs.set("examType", params.examType);
      return request<PaginatedData<Course>>(`${BASE}/courses?${qs.toString()}`, { method: "GET" });
    },
    getCourse: (id: string) => request<Course>(`${BASE}/courses/${id}`, { method: "GET" }),
    createCourse: (body: {
      title: string;
      categoryId?: string;
      examType?: string;
      description?: string;
      priceAmount?: number;
      priceCurrency?: string;
    }) => request<Course>(`${BASE}/courses`, { method: "POST", body }),
    updateCourse: (
      id: string,
      body: Partial<{
        title: string;
        description: string;
        examType: string;
        categoryId: string;
        priceAmount: number;
        priceCurrency: string;
        isFree: boolean;
      }>,
    ) => request<Course>(`${BASE}/courses/${id}`, { method: "PATCH", body }),
    setCourseStatus: (id: string, status: ContentStatus) =>
      request<Course>(`${BASE}/courses/${id}/status`, { method: "PATCH", body: { status } }),
    reorderCourses: (orderedIds: string[]) =>
      request<void>(`${BASE}/courses/reorder`, { method: "POST", body: { orderedIds } }),
    deleteCourse: (id: string) => request<void>(`${BASE}/courses/${id}`, { method: "DELETE" }),

    // Subjects/Topics/Modules/Lessons share one collection-agnostic shape server-side.
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
    reorderNodes: (collection: string, orderedIds: string[]) =>
      request<void>(`${BASE}/${collection}/reorder`, { method: "POST", body: { orderedIds } }),
    deleteNode: (collection: string, id: string) =>
      request<void>(`${BASE}/${collection}/${id}`, { method: "DELETE" }),
  };
}
