"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { useSubmissionWorkspace } from "@/components/assignment/use-submission-workspace";
import { SubmissionStatusChip } from "@/components/assignment/submission-status-chip";
import { SubmissionFileList } from "@/components/assignment/submission-file-list";
import { FileUploadZone } from "@/components/assignment/file-upload-zone";
import { SubmissionNotes } from "@/components/assignment/submission-notes";
import { SubmitConfirmDialog } from "@/components/assignment/submit-confirm-dialog";
import { DecisionBanner } from "@/components/assignment/decision-banner";
import { RubricBreakdown } from "@/components/assignment/rubric-breakdown";
import { FeedbackTimeline } from "@/components/assignment/feedback-timeline";
import { WorkspaceSkeleton } from "@/components/assignment/skeletons";

function WorkspaceContent() {
  const { id: submissionId } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    loadState,
    submission,
    assignment,
    comments,
    notes,
    setNotes,
    notesStatus,
    saveNotes,
    uploads,
    uploadFiles,
    removeFile,
    downloadFile,
    submitError,
    submitting,
    submit,
    postingComment,
    postComment,
    startResubmission,
  } = useSubmissionWorkspace(submissionId);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [resubmitting, setResubmitting] = React.useState(false);

  if (loadState === "not-found") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={ClipboardList}
          heading="Submission not available"
          body="This submission doesn't exist or doesn't belong to you."
          actionLabel="Back to assignments"
          actionHref="/assignments"
        />
      </main>
    );
  }

  if (loadState === "loading" || !submission) {
    return <WorkspaceSkeleton />;
  }

  const isDraft = submission.status === "DRAFT";
  const isDecided = submission.status === "APPROVED" || submission.status === "REVISION_REQUESTED";

  async function handleResubmit(): Promise<void> {
    setResubmitting(true);
    try {
      const nextId = await startResubmission();
      router.push(`/assignments/submission/${nextId}`);
    } finally {
      setResubmitting(false);
    }
  }

  async function handleSubmit(): Promise<void> {
    await submit();
    setConfirmOpen(false);
  }

  return (
    <main className="mx-auto flex max-w-[1000px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
          <Link href={`/assignments/${submission.assignmentId}`} className="hover:underline">
            {submission.assignmentTitle}
          </Link>{" "}
          <span aria-hidden="true">·</span>{" "}
          <span className="text-neutral-800">Version {submission.version}</span>
        </nav>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {submission.assignmentTitle}
          </h1>
          <SubmissionStatusChip status={submission.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-8 lg:order-1">
          {isDecided && submission.review ? (
            <DecisionBanner
              review={submission.review}
              marksTotal={assignment?.marksTotal}
              onResubmit={() => void handleResubmit()}
              resubmitting={resubmitting}
            />
          ) : null}

          {isDecided && submission.review && submission.review.scores.length > 0 ? (
            <RubricBreakdown scores={submission.review.scores} />
          ) : null}

          <Card>
            <h2 className="font-heading text-base font-semibold text-neutral-900">Files</h2>
            <div className="mt-3">
              <SubmissionFileList
                files={submission.files}
                uploads={isDraft ? uploads : []}
                canModify={isDraft}
                onRemove={(fileId) => void removeFile(fileId)}
                onDownload={(fileId) => void downloadFile(fileId)}
              />
            </div>
            {isDraft && assignment ? (
              <div className="mt-4">
                <FileUploadZone
                  fileRules={assignment.fileRules}
                  remainingSlots={Math.max(
                    0,
                    assignment.fileRules.maxFiles - submission.files.length - uploads.length,
                  )}
                  disabled={false}
                  onFilesAccepted={uploadFiles}
                />
              </div>
            ) : null}
          </Card>

          {!isDecided ? (
            <Card>
              <SubmissionNotes
                value={notes}
                onChange={setNotes}
                onSave={(v) => void saveNotes(v)}
                status={notesStatus}
                disabled={!isDraft}
              />
            </Card>
          ) : null}

          {submitError ? <p className="text-sm text-error-600">{submitError}</p> : null}

          {isDraft ? (
            <div>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="flex h-11 items-center justify-center rounded-md bg-primary-600 px-6 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                Submit
              </button>
            </div>
          ) : submission.status === "SUBMITTED" || submission.status === "UNDER_REVIEW" ? (
            <p className="text-sm text-neutral-500">Awaiting review.</p>
          ) : null}

          <FeedbackTimeline
            comments={comments}
            review={submission.review}
            onPostComment={(body) => void postComment(body)}
            posting={postingComment}
          />
        </div>

        <div className="lg:order-2">
          {assignment ? (
            <Card className="lg:sticky lg:top-20">
              <h2 className="font-heading text-base font-semibold text-neutral-900">
                Assignment brief
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">
                {assignment.brief}
              </p>
              {assignment.criteria.length > 0 ? (
                <div className="mt-5 border-t border-neutral-100 pt-4">
                  <p className="text-sm font-medium text-neutral-800">Rubric</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {assignment.criteria.map((c) => (
                      <li key={c.id} className="flex items-start justify-between gap-3 text-sm">
                        <span className="text-neutral-600">{c.title}</span>
                        <span className="shrink-0 tabular-nums text-neutral-400">{c.maxMarks}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>

      <SubmitConfirmDialog
        open={confirmOpen}
        fileCount={submission.files.length}
        submitting={submitting}
        onConfirm={() => void handleSubmit()}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}

export default function SubmissionWorkspacePage() {
  return (
    <RequireAuth>
      <WorkspaceContent />
    </RequireAuth>
  );
}
