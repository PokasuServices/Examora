"use client";

import * as React from "react";
import Link from "next/link";
import type { ThreadSummary } from "@examora/types";
import { Button, Input } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { useCommunityApi } from "@/lib/community-api";

function CommunitySearchContent() {
  const api = useCommunityApi();
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<ThreadSummary[]>([]);
  const [searched, setSearched] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  async function handleSearch(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setLoading(true);
    try {
      const res = await api.search(q.trim());
      setResults(res.items);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-4 text-sm text-neutral-500">
        <Link href="/community" className="hover:underline">
          Community
        </Link>
      </nav>

      <h1 className="text-heading">Search discussions &amp; questions</h1>

      <form className="mt-6 flex gap-2" onSubmit={(e) => void handleSearch(e)}>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by keyword…"
          minLength={2}
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      {searched && results.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No results for &ldquo;{q}&rdquo;.</p>
      ) : null}

      <ul className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {results.map((thread) => (
          <li key={thread.id} className="px-4 py-4">
            <Link href={`/community/threads/${thread.id}`} className="hover:underline">
              <h2 className="font-medium">{thread.title}</h2>
            </Link>
            <p className="mt-1 text-xs text-neutral-500">
              {thread.boardTitle} · {thread.type} · {thread.replyCount} repl
              {thread.replyCount === 1 ? "y" : "ies"}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function CommunitySearchPage() {
  return (
    <RequireAuth>
      <CommunitySearchContent />
    </RequireAuth>
  );
}
