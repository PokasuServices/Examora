"use client";

import * as React from "react";
import Link from "next/link";
import type { AssignmentSummary } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { useAssignmentApi } from "@/lib/assignment-api";

function AssignmentCatalogContent() {
  const api = useAssignmentApi();
  const [assignments, setAssignments] = React.useState<AssignmentSummary[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    api
      .listAssignments()
      .then((res) => setAssignments(res.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-heading">Assignments</h1>
        <Link href="/dashboard" className="text-sm text-primary-600 hover:underline">
          My learning →
        </Link>
      </div>

      {loading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}
      {!loading && assignments.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No published assignments yet.</p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {assignments.map((a) => (
          <Link
            key={a.id}
            href={`/assignments/${a.id}`}
            className="rounded-lg border border-neutral-200 bg-white p-5 transition-colors hover:border-primary-400"
          >
            <h2 className="text-lg font-semibold">{a.title}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-600">
              <span className="rounded-full bg-neutral-100 px-2 py-0.5">{a.marksTotal} marks</span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                {a.criteriaCount} rubric criteri{a.criteriaCount === 1 ? "on" : "a"}
              </span>
              {a.deadline ? (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                  Due {new Date(a.deadline).toLocaleDateString()}
                </span>
              ) : null}
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{a.brief}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}

export default function AssignmentCatalogPage() {
  return (
    <RequireAuth>
      <AssignmentCatalogContent />
    </RequireAuth>
  );
}
