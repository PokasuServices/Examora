"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { CreateThreadForm } from "@/components/community/create-thread-form";

function NewThreadContent() {
  return (
    <main className="mx-auto max-w-2xl">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-neutral-500">
        <Link href="/community" className="hover:text-primary-600 hover:underline">
          Community
        </Link>
      </nav>
      <h1 className="text-xl font-semibold text-neutral-800">Start a discussion</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Pick a board, then share what&rsquo;s on your mind or ask a question.
      </p>
      <div className="mt-6">
        <CreateThreadForm />
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
