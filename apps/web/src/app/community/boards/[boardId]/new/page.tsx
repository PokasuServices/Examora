"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ThreadType } from "@examora/types";
import { Button, Input, Label } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { useCommunityApi } from "@/lib/community-api";

function NewThreadContent() {
  const { boardId } = useParams<{ boardId: string }>();
  const router = useRouter();
  const api = useCommunityApi();
  const [type, setType] = React.useState<ThreadType>("DISCUSSION");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const thread = await api.createThread({ boardId, type, title, body });
      router.push(`/community/threads/${thread.id}`);
    } catch {
      setError("Could not create the thread. Check your input and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <nav className="mb-4 text-sm text-neutral-500">
        <Link href={`/community/boards/${boardId}`} className="hover:underline">
          Back to board
        </Link>
      </nav>

      <h1 className="text-heading">Start a new thread</h1>

      <form className="mt-6 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
        <div>
          <Label htmlFor="thread-type">Type</Label>
          <select
            id="thread-type"
            className="mt-1 block h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as ThreadType)}
          >
            <option value="DISCUSSION">Discussion</option>
            <option value="QUESTION">Question (Doubt Resolution)</option>
          </select>
        </div>

        <div>
          <Label htmlFor="thread-title">Title</Label>
          <Input
            id="thread-title"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="thread-body">
            {type === "QUESTION" ? "What's your question?" : "What's on your mind?"}
          </Label>
          <textarea
            id="thread-body"
            required
            maxLength={20000}
            className="mt-1 min-h-40 w-full rounded-md border border-neutral-300 p-3 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        {error ? <p className="text-sm text-error-600">{error}</p> : null}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Posting…" : "Post"}
        </Button>
      </form>
    </main>
  );
}

export default function NewThreadPage() {
  return (
    <RequireAuth>
      <NewThreadContent />
    </RequireAuth>
  );
}
