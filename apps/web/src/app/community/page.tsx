"use client";

import * as React from "react";
import Link from "next/link";
import type { ForumBoard, ForumCategory } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { useCommunityApi } from "@/lib/community-api";

function CommunityHomeContent() {
  const api = useCommunityApi();
  const [categories, setCategories] = React.useState<ForumCategory[]>([]);
  const [boardsByCategory, setBoardsByCategory] = React.useState<Record<string, ForumBoard[]>>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api
      .listCategories()
      .then(async (res) => {
        setCategories(res.items);
        const entries = await Promise.all(
          res.items.map(async (category) => {
            const boards = await api.listBoards(category.id);
            return [category.id, boards.items] as const;
          }),
        );
        setBoardsByCategory(Object.fromEntries(entries));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Community</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/community/search" className="text-primary-600 hover:underline">
            Search
          </Link>
          <Link href="/community/bookmarks" className="text-primary-600 hover:underline">
            My bookmarks
          </Link>
        </div>
      </div>

      {loading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}
      {!loading && categories.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No forum categories yet.</p>
      ) : null}

      <div className="mt-6 space-y-8">
        {categories.map((category) => (
          <section key={category.id}>
            <h2 className="text-lg font-semibold">{category.title}</h2>
            {category.description ? (
              <p className="mt-1 text-sm text-neutral-600">{category.description}</p>
            ) : null}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(boardsByCategory[category.id] ?? []).map((board) => (
                <Link
                  key={board.id}
                  href={`/community/boards/${board.id}`}
                  className="rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-primary-400"
                >
                  <h3 className="font-medium">{board.title}</h3>
                  {board.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                      {board.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-neutral-500">
                    {board.threadCount} thread{board.threadCount === 1 ? "" : "s"}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

export default function CommunityHomePage() {
  return (
    <RequireAuth>
      <CommunityHomeContent />
    </RequireAuth>
  );
}
