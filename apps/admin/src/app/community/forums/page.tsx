"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { ForumBoard, ForumCategory } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { useCommunityAdminApi } from "@/lib/community-api";

function ForumsContent() {
  const api = useCommunityAdminApi();
  const [categories, setCategories] = React.useState<ForumCategory[]>([]);
  const [boards, setBoards] = React.useState<ForumBoard[]>([]);
  const [categoryTitle, setCategoryTitle] = React.useState("");
  const [boardTitle, setBoardTitle] = React.useState("");
  const [boardCategoryId, setBoardCategoryId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .listCategories()
      .then((res) => setCategories(res.items))
      .catch(() => undefined);
    api
      .listBoards()
      .then((res) => setBoards(res.items))
      .catch(() => undefined);
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
    await api.updateCategory(category.id, { isActive: !category.isActive });
    load();
  }

  async function toggleBoardActive(board: ForumBoard): Promise<void> {
    await api.updateBoard(board.id, { isActive: !board.isActive });
    load();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-heading">Forum categories &amp; boards</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Manage the discussion forum hierarchy (community:manage).
      </p>
      <FieldError>{error}</FieldError>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-700">Categories</h2>
        <form
          onSubmit={(e) => void createCategory(e)}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
        >
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

        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Boards</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">{category.title}</td>
                  <td className="px-4 py-3">{category.boardCount}</td>
                  <td className="px-4 py-3">{category.isActive ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" onClick={() => void toggleCategoryActive(category)}>
                      {category.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                    No categories yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-neutral-700">Boards</h2>
        <form
          onSubmit={(e) => void createBoard(e)}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="boardCategoryId">Category</Label>
            <select
              id="boardCategoryId"
              className="h-10 w-56 rounded-md border border-neutral-300 px-3 text-sm"
              value={boardCategoryId}
              onChange={(e) => setBoardCategoryId(e.target.value)}
            >
              <option value="">— choose —</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.title}
                </option>
              ))}
            </select>
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

        <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Threads</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {boards.map((board) => (
                <tr key={board.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">{board.title}</td>
                  <td className="px-4 py-3">{board.categoryTitle}</td>
                  <td className="px-4 py-3">{board.threadCount}</td>
                  <td className="px-4 py-3">{board.isActive ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" onClick={() => void toggleBoardActive(board)}>
                      {board.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
              {boards.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    No boards yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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
