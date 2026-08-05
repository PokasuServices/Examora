"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flame, MessagesSquare, PenSquare, Search, Sparkles } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { ThreadCard } from "@/components/community/thread-card";
import { ThreadCardSkeletonList } from "@/components/community/skeletons";
import { useCommunityHome } from "@/components/community/use-community-home";

function CommunityHomeContent() {
  const router = useRouter();
  const data = useCommunityHome();
  const [query, setQuery] = React.useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/community/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="rounded-card bg-gradient-to-br from-primary-600 to-primary-700 p-8 text-white shadow-soft sm:p-10">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">Community</h1>
        <p className="mt-2 max-w-xl text-sm text-primary-50 sm:text-base">
          Ask questions, help other learners, and follow the discussions that matter to your
          courses.
        </p>
        <form onSubmit={handleSearch} className="mt-6 flex max-w-lg gap-2">
          <label htmlFor="community-hero-search" className="sr-only">
            Search discussions and questions
          </label>
          <div className="relative flex-1">
            <Search
              size={16}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <input
              id="community-hero-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search discussions & questions…"
              className="h-11 w-full rounded-md border-0 bg-white pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            />
          </div>
          <button
            type="submit"
            className="flex h-11 shrink-0 items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Search
          </button>
        </form>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/community/new"
          className="flex h-11 items-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <PenSquare size={16} strokeWidth={1.75} aria-hidden="true" />
          Start a discussion
        </Link>
        <Link
          href="/community/me"
          className="flex h-11 items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <MessagesSquare size={16} strokeWidth={1.75} aria-hidden="true" />
          My discussions
        </Link>
        <Link
          href="/community/search"
          className="flex h-11 items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          Advanced search
        </Link>
      </div>

      {data.status === "error" ? (
        <RetryInline message="Couldn't load the community" onRetry={data.retry} />
      ) : (
        <>
          {/* Trending */}
          <section aria-labelledby="trending-heading">
            <div className="flex items-center gap-2">
              <Flame size={18} strokeWidth={1.75} className="text-warning-600" aria-hidden="true" />
              <h2
                id="trending-heading"
                className="font-heading text-lg font-semibold text-neutral-900"
              >
                Trending discussions
              </h2>
            </div>
            <p className="mt-1 text-xs text-neutral-500">Most liked and replied to recently.</p>
            <div className="mt-3">
              {data.status === "loading" ? (
                <ThreadCardSkeletonList count={4} />
              ) : data.trending.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  heading="Nothing trending yet"
                  body="Be the first to start a conversation."
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {data.trending.map((thread) => (
                    <ThreadCard key={thread.id} thread={thread} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Recent */}
          <section aria-labelledby="recent-heading">
            <div className="flex items-center justify-between">
              <h2
                id="recent-heading"
                className="font-heading text-lg font-semibold text-neutral-900"
              >
                Recent discussions
              </h2>
            </div>
            <div className="mt-3">
              {data.status === "loading" ? (
                <ThreadCardSkeletonList count={5} />
              ) : data.recentThreads.length === 0 ? (
                <EmptyState
                  icon={MessagesSquare}
                  heading="No discussions yet"
                  body="Start the first conversation in the community."
                  actionLabel="Start a discussion"
                  actionHref="/community/new"
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {data.recentThreads.map((thread) => (
                    <ThreadCard key={thread.id} thread={thread} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Categories & boards */}
          <section aria-labelledby="categories-heading">
            <h2
              id="categories-heading"
              className="font-heading text-lg font-semibold text-neutral-900"
            >
              Browse by category
            </h2>
            {data.status === "loading" ? null : data.categories.length === 0 ? (
              <div className="mt-3">
                <EmptyState heading="No forum categories yet" />
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-6">
                {data.categories.map((category) => (
                  <div key={category.id}>
                    <h3 className="text-sm font-semibold text-neutral-700">{category.title}</h3>
                    {category.description ? (
                      <p className="mt-0.5 text-xs text-neutral-500">{category.description}</p>
                    ) : null}
                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {(data.boardsByCategory[category.id] ?? []).map((board) => (
                        <Link key={board.id} href={`/community/boards/${board.id}`}>
                          <Card interactive density="compact">
                            <h4 className="font-medium text-neutral-900">{board.title}</h4>
                            {board.description ? (
                              <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                                {board.description}
                              </p>
                            ) : null}
                            <Chip tone="neutral" className="mt-2">
                              {board.threadCount} {board.threadCount === 1 ? "thread" : "threads"}
                            </Chip>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
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
