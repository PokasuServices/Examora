"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { SketchWorkView } from "@examora/types";
import { Button, FieldError, cn } from "@examora/ui";
import { Eye, Flag, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { ClapButton } from "@/components/community/clap-share";
import { RevisionUpload } from "@/components/student/revision-upload";
import { PinBoard } from "@/components/student/sketch-pins";
import { useSketchPaper } from "@/components/student/sketch-paper";
import { SketchRatingsPanel } from "@/components/student/sketch-ratings";
import { Chip } from "@/components/ui/chip";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useStudentApi } from "@/lib/student-api";

const KIND_LABEL = { OWNER: "Artist", EXPERT: "Expert", PEER: "Student" } as const;
const KIND_TONE = { OWNER: "neutral", EXPERT: "primary", PEER: "warning" } as const;

function VersionMenu({
  canDelete,
  canReport,
  reported,
  onDelete,
  onReport,
}: {
  canDelete: boolean;
  canReport: boolean;
  reported: boolean;
  onDelete: () => void;
  onReport: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  if (!canDelete && !canReport) return null;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-white/5"
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-soft-hover dark:border-neutral-800 dark:bg-neutral-900"
        >
          {canDelete ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger-600 hover:bg-neutral-50 dark:hover:bg-white/5"
            >
              <Trash2 size={14} aria-hidden="true" /> Delete this upload
            </button>
          ) : null}
          {canReport ? (
            <button
              type="button"
              role="menuitem"
              disabled={reported}
              onClick={() => {
                setOpen(false);
                onReport();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-white/5"
            >
              <Flag size={14} aria-hidden="true" /> {reported ? "Reported" : "Report abuse"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One student's sketch for a question: the original and revisions as tabs,
 * the image with pinned comments, description, reviewer marks, views, claps,
 * comments, and (for the owner) uploading a revision.
 */
export function SketchWorkPanel({
  work,
  questionId,
  onChange,
  onSelfRated,
}: {
  work: SketchWorkView;
  questionId: string;
  onChange: (work: SketchWorkView) => void;
  /** Called after the owner rates a version (with the XP earned). */
  onSelfRated?: (xp: number) => void;
}) {
  const api = useStudentApi();
  const quizId = useSketchPaper();
  const [versionId, setVersionId] = React.useState(
    work.versions[work.versions.length - 1]?.id ?? null,
  );
  const [uploading, setUploading] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [clap, setClap] = React.useState({ clapped: work.clappedByMe, count: work.claps });
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => setClap({ clapped: work.clappedByMe, count: work.claps }), [work]);
  const version =
    work.versions.find((v) => v.id === versionId) ?? work.versions[work.versions.length - 1];
  React.useEffect(() => {
    if (!work.versions.some((v) => v.id === versionId)) {
      setVersionId(work.versions[work.versions.length - 1]?.id ?? null);
    }
  }, [work, versionId]);

  async function run(fn: () => Promise<SketchWorkView | void>, done?: string) {
    setError(null);
    setNotice(null);
    try {
      const next = await fn();
      if (next) onChange(next);
      if (done) setNotice(done);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  }

  const remaining = work.maxVersions - work.versions.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Versions" className="flex flex-wrap gap-1.5">
          {work.versions.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={!uploading && v.id === version?.id}
              onClick={() => {
                setUploading(false);
                setEditing(false);
                setVersionId(v.id);
              }}
              className={cn(
                "h-8 rounded-full border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                !uploading && v.id === version?.id
                  ? "border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-500/40 dark:bg-primary-500/15 dark:text-primary-300"
                  : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-white/[0.03]",
              )}
            >
              {v.label}
            </button>
          ))}
          {work.isMine && work.canUpload ? (
            <button
              type="button"
              role="tab"
              aria-selected={uploading}
              onClick={() => setUploading(true)}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-full border border-dashed px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                uploading
                  ? "border-primary-400 bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300"
                  : "border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400",
              )}
            >
              <Plus size={12} aria-hidden="true" /> Upload revision
            </button>
          ) : null}
        </div>
        <span className="ml-auto text-xs text-neutral-500">
          {work.versions.length} of {work.maxVersions} uploads used
        </span>
      </div>

      {uploading ? (
        <RevisionUpload
          questionId={questionId}
          remaining={remaining}
          onCancel={() => setUploading(false)}
          onSaved={(next) => {
            setUploading(false);
            onChange(next);
            setVersionId(next.versions[next.versions.length - 1]?.id ?? null);
            setNotice("Uploaded. It appears once the safety scan finishes.");
          }}
        />
      ) : version ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {version.label} · uploaded{" "}
              {new Date(version.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 text-xs text-neutral-500"
                title="Students who viewed this sketch"
              >
                <Eye size={14} aria-hidden="true" /> {work.views}{" "}
                <span className="sr-only">views</span>
              </span>
              {work.isMine ? (
                <span className="text-xs text-neutral-500">👏 {clap.count}</span>
              ) : (
                <ClapButton
                  size="sm"
                  clapped={clap.clapped}
                  count={clap.count}
                  onToggle={async () => {
                    try {
                      const r = await api.clapWork(work.id);
                      setClap({ clapped: r.clapped, count: r.claps });
                    } catch {
                      setError("Couldn't clap. Try again.");
                    }
                  }}
                />
              )}
              <VersionMenu
                canDelete={version.canDelete}
                canReport={!work.isMine}
                reported={work.reportedByMe}
                onDelete={() => {
                  if (window.confirm(`Delete ${version.label}? This frees one upload.`)) {
                    void run(
                      () => api.deleteVersion(version.id, quizId),
                      `${version.label} deleted.`,
                    );
                  }
                }}
                onReport={() => {
                  const reason = window.prompt("What's wrong with this sketch?");
                  if (reason && reason.trim().length >= 3) {
                    void run(async () => {
                      await api.reportWork(work.id, reason.trim());
                      onChange({ ...work, reportedByMe: true });
                    }, "Thanks. A moderator will look at it.");
                  }
                }}
              />
            </div>
          </div>

          {/* Sketch on the left, ratings (self-evaluation first) beside it. */}
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <PinBoard
              key={version.id}
              imageRef={version.imageRef}
              imageAlt={`${work.isMine ? "Your" : `${work.ownerName}'s`} sketch, ${version.label}`}
              load={() => api.versionPins(version.id)}
              add={(c) => api.addVersionPin(version.id, c)}
              remove={(id) => api.deleteSketchComment(id)}
              imageClassName="max-h-[60vh]"
            />

            <SketchRatingsPanel
              key={`ratings-${version.id}`}
              work={work}
              version={version}
              onWork={onChange}
              onSelfRated={onSelfRated}
            />
          </div>

          {version.expert ? (
            <div className="rounded-md bg-neutral-50 px-3 py-2 text-sm dark:bg-white/[0.03]">
              {version.expert.marks !== null ? (
                <p className="font-medium text-neutral-800 dark:text-white/90">
                  Reviewer&rsquo;s marks: {version.expert.marks} / {version.expert.maxMarks}{" "}
                  <span className="font-normal text-neutral-500">
                    (counts toward the test score)
                  </span>
                </p>
              ) : (
                <p className="text-neutral-600 dark:text-neutral-400">
                  Waiting for the reviewer&rsquo;s marks.
                </p>
              )}
              {version.expert.comment ? (
                <p className="mt-1 italic text-neutral-700 dark:text-neutral-300">
                  {version.expert.comment}
                </p>
              ) : null}
            </div>
          ) : null}

          {editing ? (
            <div className="flex flex-col gap-2">
              <label
                htmlFor={`desc-${version.id}`}
                className="text-sm text-neutral-700 dark:text-neutral-300"
              >
                Description
              </label>
              <textarea
                id={`desc-${version.id}`}
                rows={2}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void run(async () => {
                      const next = await api.describeVersion(version.id, description, quizId);
                      setEditing(false);
                      return next;
                    })
                  }
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm">
              <p
                className={cn(
                  "flex-1",
                  version.description
                    ? "text-neutral-700 dark:text-neutral-300"
                    : "italic text-neutral-500",
                )}
              >
                {version.description ?? "No description."}
              </p>
              {work.isMine ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDescription(version.description ?? "");
                    setEditing(true);
                  }}
                >
                  <Pencil size={14} aria-hidden="true" className="mr-1" /> Edit description
                </Button>
              ) : null}
            </div>
          )}
        </>
      ) : null}

      <FieldError>{error}</FieldError>
      {notice ? (
        <p role="status" className="text-sm text-success-600 dark:text-success-400">
          {notice}
        </p>
      ) : null}

      <section
        aria-labelledby={`comments-${work.id}`}
        className="border-t border-neutral-200 pt-4 dark:border-neutral-800"
      >
        <h3
          id={`comments-${work.id}`}
          className="text-sm font-medium text-neutral-800 dark:text-white/90"
        >
          Comments ({work.comments.length})
        </h3>
        {work.comments.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No comments yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {work.comments.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-neutral-200 p-2.5 text-sm dark:border-neutral-800"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-neutral-800 dark:text-white/90">
                    {c.mine ? "You" : c.authorName}
                  </span>
                  <Chip tone={KIND_TONE[c.authorKind]}>{KIND_LABEL[c.authorKind]}</Chip>
                  <span className="text-xs text-neutral-500">
                    {new Date(c.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  {c.mine ? (
                    <button
                      type="button"
                      aria-label="Delete comment"
                      onClick={() =>
                        void run(async () => {
                          await api.deleteWorkComment(c.id);
                          return { ...work, comments: work.comments.filter((x) => x.id !== c.id) };
                        })
                      }
                      className="ml-auto rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-danger-600 dark:hover:bg-white/5"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                  {c.body}
                </p>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!comment.trim()) return;
            void run(async () => {
              const next = await api.commentOnWork(work.id, comment.trim(), quizId);
              setComment("");
              return next;
            });
          }}
        >
          <label htmlFor={`new-comment-${work.id}`} className="sr-only">
            Add a comment
          </label>
          <textarea
            id={`new-comment-${work.id}`}
            rows={2}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment about the whole sketch"
            className="w-full rounded-md border border-neutral-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <div>
            <Button type="submit" size="sm" variant="outline" disabled={!comment.trim()}>
              Post comment
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
