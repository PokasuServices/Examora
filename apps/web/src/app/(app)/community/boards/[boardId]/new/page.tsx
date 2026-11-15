"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { CreateThreadForm } from "@/components/community/create-thread-form";

function NewThreadContent() {
  const { boardId } = useParams<{ boardId: string }>();

  return (
    <main className="mx-auto max-w-2xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-neutral-500">
        <Link href="/community" className="hover:text-primary-600 hover:underline">
          Community
        </Link>{" "}
        /{" "}
        <Link
          href={`/community/boards/${boardId}`}
          className="hover:text-primary-600 hover:underline"
        >
          Back to board
        </Link>
      </nav>
      <h1 className="text-xl font-semibold text-neutral-800">Start a new thread</h1>
      <div className="mt-6">
        <CreateThreadForm initialBoardId={boardId} />
      </div>
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
