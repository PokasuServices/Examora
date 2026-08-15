"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { LESSON_CONTENT_TYPES, type Lesson, type LessonContentType } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { SelectField } from "@/components/ui/select-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ContentStatusActions } from "./content-status-actions";

const CONTENT_TYPE_OPTIONS = LESSON_CONTENT_TYPES.map((t) => ({ value: t, label: t }));

export function LessonEditPanel({
  lesson,
  siblingIndex,
  siblingCount,
  mutationStatus,
  mutationError,
  onSave,
  onStatusChange,
  onDelete,
  onMove,
}: {
  lesson: Lesson;
  siblingIndex: number;
  siblingCount: number;
  mutationStatus: "idle" | "submitting" | "error";
  mutationError: string | null;
  onSave: (body: Record<string, unknown>) => Promise<boolean>;
  onStatusChange: (status: Lesson["status"]) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onMove: (direction: "up" | "down") => void;
}) {
  const [title, setTitle] = React.useState(lesson.title);
  const [slug, setSlug] = React.useState(lesson.slug);
  const [contentType, setContentType] = React.useState<LessonContentType>(lesson.contentType);
  const [body, setBody] = React.useState(lesson.body ?? "");
  const [contentUrl, setContentUrl] = React.useState(lesson.contentUrl ?? "");
  const [durationMinutes, setDurationMinutes] = React.useState(
    lesson.durationMinutes !== null ? String(lesson.durationMinutes) : "",
  );
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    setTitle(lesson.title);
    setSlug(lesson.slug);
    setContentType(lesson.contentType);
    setBody(lesson.body ?? "");
    setContentUrl(lesson.contentUrl ?? "");
    setDurationMinutes(lesson.durationMinutes !== null ? String(lesson.durationMinutes) : "");
  }, [lesson]);

  async function handleDelete(): Promise<void> {
    const ok = await onDelete();
    if (ok) setConfirmDelete(false);
  }

  const isTextLike = contentType === "TEXT" || contentType === "ARTICLE";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <ContentStatusActions
          status={lesson.status}
          mutationStatus={mutationStatus}
          mutationError={mutationError}
          onChange={onStatusChange}
          entityLabel="lesson"
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Move up"
            disabled={siblingIndex === 0}
            onClick={() => onMove("up")}
            className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowUp size={15} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={siblingIndex === siblingCount - 1}
            onClick={() => onMove("down")}
            className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowDown size={15} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Delete lesson"
            onClick={() => setConfirmDelete(true)}
            className="rounded p-1.5 text-danger-500 hover:bg-danger-50"
          >
            <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({
            title,
            slug,
            contentType,
            body: isTextLike ? body || undefined : undefined,
            contentUrl: !isTextLike ? contentUrl || undefined : undefined,
            durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
          });
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lesson-title">Title</Label>
            <Input
              id="lesson-title"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lesson-slug">Slug</Label>
            <Input id="lesson-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="lesson-content-type"
            label="Content type"
            value={contentType}
            options={CONTENT_TYPE_OPTIONS}
            onChange={(v) => setContentType(v as LessonContentType)}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lesson-duration">Duration (minutes)</Label>
            <Input
              id="lesson-duration"
              type="number"
              min={0}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </div>
        </div>

        {isTextLike ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lesson-body">Body (plain text / markdown)</Label>
            <textarea
              id="lesson-body"
              maxLength={50000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lesson-content-url">Content URL</Label>
            <Input
              id="lesson-content-url"
              type="url"
              maxLength={2000}
              value={contentUrl}
              placeholder="https://…"
              onChange={(e) => setContentUrl(e.target.value)}
            />
            <p className="text-xs text-neutral-400">
              Hosted media reference — there&rsquo;s no built-in upload for lesson media yet, only a
              URL field.
            </p>
          </div>
        )}

        <FieldError>{mutationError}</FieldError>
        <div>
          <Button type="submit" disabled={mutationStatus === "submitting"}>
            {mutationStatus === "submitting" ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this lesson?"
        message={
          <>
            Delete <span className="font-medium text-neutral-800">{lesson.title}</span>? This
            can&rsquo;t be undone.
          </>
        }
        confirmLabel="Delete"
        tone="danger"
        submitting={mutationStatus === "submitting"}
        error={mutationError}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
