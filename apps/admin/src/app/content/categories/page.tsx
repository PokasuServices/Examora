"use client";

import * as React from "react";
import Link from "next/link";
import { ApiError } from "@examora/auth-client";
import type { Category } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { useContentApi } from "@/lib/content-api";

function CategoriesContent() {
  const api = useContentApi();
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    api
      .listCategories()
      .then((res) => setCategories(res.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function create(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await api.createCategory({ name });
      setName("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create category");
    }
  }

  async function toggleActive(category: Category): Promise<void> {
    await api.updateCategory(category.id, { isActive: !category.isActive });
    load();
  }

  async function remove(id: string): Promise<void> {
    await api.deleteCategory(id);
    load();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/content/courses" className="hover:underline">
          Courses
        </Link>{" "}
        · <span className="text-neutral-800">Categories</span>
      </nav>
      <h1 className="text-heading">Categories</h1>

      <form onSubmit={create} className="mt-6 flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="name">New category name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <Button type="submit">Add</Button>
      </form>
      <FieldError>{error}</FieldError>

      <ul className="mt-8 flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {loading ? <li className="p-4 text-sm text-neutral-500">Loading…</li> : null}
        {!loading && categories.length === 0 ? (
          <li className="p-4 text-sm text-neutral-500">No categories yet.</li>
        ) : null}
        {categories.map((category) => (
          <li key={category.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{category.name}</p>
              <p className="text-sm text-neutral-500">
                /{category.slug} · {category.isActive ? "Active" : "Inactive"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => void toggleActive(category)}>
                {category.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button variant="ghost" onClick={() => void remove(category.id)}>
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function CategoriesPage() {
  return (
    <RequirePermission permission="content:manage">
      <CategoriesContent />
    </RequirePermission>
  );
}
