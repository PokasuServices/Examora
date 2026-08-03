"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { AssignmentDetail, SubmissionHistoryItem } from "@examora/types";
import { Button } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { useAssignmentApi } from "@/lib/assignment-api";

function AssignmentDetailContent() {
  const { id: assignmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useAssignmentApi();
  const [assignment, setAssignment] = React.useState<AssignmentDetail | null>(null);
  const [history, setHistory] = React.useState<SubmissionHistoryItem[]>([]);
  const [notFound, setNotFound] = React.useState(false);
  const [starting, setStarting] = React.useState(false);

  React.useEffect(() => {
    api
      .getAssignment(assignmentId)
      .then(setAssignment)
      .catch(() => setNotFound(true));
    api
      .listHistory(assignmentId)
      .then((res) => setHistory(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  async function handleStart(): Promise<void> {
    setStarting(true);
    try {
      const submission = await api.startSubmission(assignmentId);
      router.push(`/assignments/submission/${submission.id}`);
    } finally {
      setStarting(false);
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-heading">Assignment not available</h1>
        <Link
          href="/assignments"
          className="mt-4 inline-block text-sm text-primary-600 hover:underline"
        >
          Back to assignments
        </Link>
      </main>
    );
  }

  if (!assignment) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-neutral-500">Loading…</p>
      </main>
    );
  }

  const latest = history[0];
  const canStartFresh = !latest || latest.status === "REVISION_REQUESTED";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/assignments" className="hover:underline">
          Assignments
        </Link>{" "}
        · <span className="text-neutral-800">{assignment.title}</span>
      </nav>

      <h1 className="text-heading">{assignment.title}</h1>
      <p className="mt-2 whitespace-pre-wrap text-body text-neutral-600">{assignment.brief}</p>

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-neutral-500">Total marks</dt>
          <dd className="font-medium">{assignment.marksTotal}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Deadline</dt>
          <dd className="font-medium">
            {assignment.deadline ? new Date(assignment.deadline).toLocaleDateString() : "None"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Files allowed</dt>
          <dd className="font-medium">
            up to {assignment.fileRules.maxFiles} ({assignment.fileRules.maxFileSizeMb}MB each)
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-700">Rubric</h2>
        <ul className="mt-2 space-y-1 text-sm text-neutral-600">
          {assignment.criteria.map((c) => (
            <li key={c.id}>
              {c.title} — {c.maxMarks} marks
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        {latest && !canStartFresh ? (
          <Button onClick={() => router.push(`/assignments/submission/${latest.id}`)}>
            {latest.status === "DRAFT" ? "Resume submission" : "View submission"}
          </Button>
        ) : (
          <Button disabled={starting} onClick={() => void handleStart()}>
            {starting ? "Starting…" : latest ? "Start new submission" : "Start submission"}
          </Button>
        )}
      </div>

      {history.length > 0 ? (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-neutral-700">Your submissions</h2>
          <ul className="mt-2 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  v{h.version} — {h.status}
                  {h.obtainedMarks !== null ? ` (${h.obtainedMarks} marks)` : ""}
                </span>
                <Link
                  href={`/assignments/submission/${h.id}`}
                  className="text-primary-600 hover:underline"
                >
                  View →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </main>
  );
}

export default function AssignmentDetailPage() {
  return (
    <RequireAuth>
      <AssignmentDetailContent />
    </RequireAuth>
  );
}
