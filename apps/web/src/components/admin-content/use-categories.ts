"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { Category } from "@examora/types";
import { useContentApi } from "@/lib/content-api";

type Status = "loading" | "ready" | "error";
export type ActiveFilter = "ALL" | "ACTIVE" | "INACTIVE";
type MutationStatus = "idle" | "submitting" | "error";

/** /admin/content/categories has no search param — query is applied client-side over this one fetch (categories are a small, flat list). */
export function useCategories() {
  const api = useContentApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [activeFilter, setActiveFilter] = React.useState<ActiveFilter>("ALL");
  const [query, setQuery] = React.useState("");
  const [mutationStatus, setMutationStatus] = React.useState<MutationStatus>("idle");
  const [mutationError, setMutationError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .listCategories({
        pageSize: 100,
        isActive: activeFilter === "ALL" ? undefined : activeFilter === "ACTIVE",
      })
      .then((res) => {
        setCategories([...res.items].sort((a, b) => a.position - b.position));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return categories;
    const q = query.trim().toLowerCase();
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
    );
  }, [categories, query]);

  async function createCategory(input: {
    name: string;
    slug?: string;
    description?: string;
  }): Promise<boolean> {
    setMutationStatus("submitting");
    setMutationError(null);
    try {
      await api.createCategory(input);
      setMutationStatus("idle");
      load();
      return true;
    } catch (err) {
      setMutationStatus("error");
      setMutationError(err instanceof ApiError ? err.message : "Could not create category.");
      return false;
    }
  }

  async function updateCategory(
    id: string,
    input: Partial<{ name: string; slug: string; description: string }>,
  ): Promise<boolean> {
    setMutationStatus("submitting");
    setMutationError(null);
    try {
      await api.updateCategory(id, input);
      setMutationStatus("idle");
      load();
      return true;
    } catch (err) {
      setMutationStatus("error");
      setMutationError(err instanceof ApiError ? err.message : "Could not update category.");
      return false;
    }
  }

  async function toggleActive(category: Category): Promise<void> {
    await api.updateCategory(category.id, { isActive: !category.isActive });
    load();
  }

  async function deleteCategory(id: string): Promise<boolean> {
    setMutationStatus("submitting");
    setMutationError(null);
    try {
      await api.deleteCategory(id);
      setMutationStatus("idle");
      load();
      return true;
    } catch (err) {
      setMutationStatus("error");
      setMutationError(err instanceof ApiError ? err.message : "Could not delete category.");
      return false;
    }
  }

  async function move(category: Category, direction: "up" | "down"): Promise<void> {
    const sorted = [...categories].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((c) => c.id === category.id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= sorted.length) return;
    [sorted[index], sorted[swapWith]] = [sorted[swapWith]!, sorted[index]!];
    await api.reorderCategories(sorted.map((c) => c.id));
    load();
  }

  return {
    status,
    categories: filtered,
    loadedCount: categories.length,
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
    retry: load,
  };
}
