"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState } from "@/components/ui/empty-state";
import { useAssignmentLanding } from "@/components/assignment/use-assignment-landing";
import { AssignmentMetaGrid } from "@/components/assignment/assignment-meta-grid";
import { RubricSummary } from "@/components/assignment/rubric-summary";
import { SubmissionHistoryList } from "@/components/assignment/submission-history-list";
import { SubmissionStatusChip } from "@/components/assignment/submission-status-chip";
import { AssignmentLandingSkeleton } from "@/components/assignment/skeletons";

function AssignmentLandingContent() {
  const { id: assignmentId } = useParams<{ id: string }>();
  const router = useRouter();
  const landing = useAssignmentLanding(assignmentId);
  const { starting, startOrResume } = landing;
  const [startError, setStartError] = React.useState<string | null>(null);

  if (landing.status === "not-found") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={ClipboardList}
          heading="Assignment not available"
          body="This assignment doesn't exist, isn't published, or has been removed."
          actionLabel="Back to assignments"
          actionHref="/assignments"
        />
      </main>
    );
  }

  if (landing.status === "loading") {
    return <AssignmentLandingSkeleton />;
  }

  const { assignment, history } = landing;
  const latest = history[0];
  // Idempotent start/resume (ADR-0015): starting again after REVISION_REQUESTED
  // creates the next version; any other latest status just returns it read-only.
  const canStartFresh = !latest || latest.status === "REVISION_REQUESTED";

  async function handleStart(): Promise<void> {
    setStartError(null);
    try {
      const submissionId = await startOrResume();
      router.push(`/assignments/submission/${submissionId}`);
    } catch {
      setStartError("Couldn't start the submission. Please try again.");
    }
  }

  function handleCtaClick(): void {
    if (canStartFresh || latest?.status === "DRAFT") {
      void handleStart();
    } else if (latest) {
      router.push(`/assignments/submission/${latest.id}`);
    }
  }

  const ctaLabel = starting
    ? "Starting…"
    : !latest
      ? "Start submission"
      : canStartFresh
        ? "Start new submission"
        : latest.status === "DRAFT"
          ? "Continue submission"
          : "View submission";

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
        <Link href="/assignments" className="hover:underline">
          Assignments
        </Link>{" "}
        <span aria-hidden="true">·</span>{" "}
        <span className="text-neutral-800">{assignment.title}</span>
      </nav>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {assignment.title}
          </h1>
          {latest ? <SubmissionStatusChip status={latest.status} /> : null}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-neutral-600">{assignment.brief}</p>
      </div>

      <AssignmentMetaGrid assignment={assignment} />
      <RubricSummary criteria={assignment.criteria} />

      <div>
        <button
          type="button"
          disabled={starting}
          onClick={handleCtaClick}
          className="flex h-11 items-center justify-center rounded-md bg-primary-600 px-6 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
        >
          {ctaLabel}
        </button>
        {startError ? <p className="mt-2 text-sm text-error-600">{startError}</p> : null}
      </div>

      <SubmissionHistoryList history={history} />
    </main>
  );
}

export default function AssignmentLandingPage() {
  return (
    <RequireAuth>
      <AssignmentLandingContent />
    </RequireAuth>
  );
}
