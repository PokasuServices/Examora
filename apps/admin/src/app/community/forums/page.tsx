"use client";

import * as React from "react";
import { FolderTree, MessageSquare } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { ForumBoard, ForumCategory } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommunityAdminApi } from "@/lib/community-api";

function ForumsContent() {
  const api = useCommunityAdminApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [categories, setCategories] = React.useState<ForumCategory[]>([]);
  const [boards, setBoards] = React.useState<ForumBoard[]>([]);
  const [categoryTitle, setCategoryTitle] = React.useState("");
  const [boardTitle, setBoardTitle] = React.useState("");
  const [boardCategoryId, setBoardCategoryId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    Promise.all([api.listCategories(), api.listBoards()])
      .then(([categoriesRes, boardsRes]) => {
        setCategories(categoriesRes.items);
        setBoards(boardsRes.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function createCategory(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    try {
      await api.createCategory({ title: categoryTitle });
      setCategoryTitle("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create category");
    }
  }

  async function createBoard(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!boardCategoryId) {
      setError("Choose a category");
      return;
    }
    try {
      await api.createBoard({ categoryId: boardCategoryId, title: boardTitle });
      setBoardTitle("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create board");
    }
  }

  async function toggleCategoryActive(category: ForumCategory): Promise<void> {
    setError(null);
    try {
      await api.updateCategory(category.id, { isActive: !category.isActive });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update category");
    }
  }

  async function toggleBoardActive(board: ForumBoard): Promise<void> {
    setError(null);
    try {
      await api.updateBoard(board.id, { isActive: !board.isActive });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update board");
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Forum categories & boards"
        subtitle="Manage the discussion forum hierarchy."
      />
      <FieldError>{error}</FieldError>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-neutral-900">Categories</h2>

        <Card density="compact">
          <form onSubmit={(e) => void createCategory(e)} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="categoryTitle">Title</Label>
              <Input
                id="categoryTitle"
                value={categoryTitle}
                onChange={(e) => setCategoryTitle(e.target.value)}
                className="w-64"
              />
            </div>
            <Button type="submit">Add category</Button>
          </form>
        </Card>

        <Card density="compact" className="min-w-0">
          {status === "loading" ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : status === "error" ? (
            <RetryInline message="Couldn't load categories" onRetry={load} />
          ) : categories.length === 0 ? (
            <EmptyState
              icon={FolderTree}
              heading="No categories yet"
              body="Add a category to get started."
            />
          ) : (
            <div className="overflow-x-auto contain-layout">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Title
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Boards
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Status
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {categories.map((category) => (
                    <tr key={category.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-900">{category.title}</td>
                      <td className="px-4 py-3 text-neutral-600">{category.boardCount}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Chip tone={category.isActive ? "success" : "neutral"}>
                          {category.isActive ? "Active" : "Inactive"}
                        </Chip>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" onClick={() => void toggleCategoryActive(category)}>
                          {category.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold text-neutral-900">Boards</h2>

        <Card density="compact">
          <form onSubmit={(e) => void createBoard(e)} className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <SelectField
                id="boardCategoryId"
                label="Category"
                value={boardCategoryId}
                options={[
                  { value: "", label: "— choose —" },
                  ...categories.map((category) => ({ value: category.id, label: category.title })),
                ]}
                onChange={setBoardCategoryId}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="boardTitle">Title</Label>
              <Input
                id="boardTitle"
                value={boardTitle}
                onChange={(e) => setBoardTitle(e.target.value)}
                className="w-64"
              />
            </div>
            <Button type="submit">Add board</Button>
          </form>
        </Card>

        <Card density="compact" className="min-w-0">
          {status === "loading" ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : status === "error" ? (
            <RetryInline message="Couldn't load boards" onRetry={load} />
          ) : boards.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              heading="No boards yet"
              body="Add a board to get started."
            />
          ) : (
            <div className="overflow-x-auto contain-layout">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Title
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Category
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Threads
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Status
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {boards.map((board) => (
                    <tr key={board.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-900">{board.title}</td>
                      <td className="px-4 py-3 text-neutral-600">{board.categoryTitle}</td>
                      <td className="px-4 py-3 text-neutral-600">{board.threadCount}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Chip tone={board.isActive ? "success" : "neutral"}>
                          {board.isActive ? "Active" : "Inactive"}
                        </Chip>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" onClick={() => void toggleBoardActive(board)}>
                          {board.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </main>
  );
}

export default function ForumsPage() {
  return (
    <RequirePermission permission="community:manage">
      <ForumsContent />
    </RequirePermission>
  );
}
