"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { SketchWorkView } from "@examora/types";
import { Button, FieldError, cn } from "@examora/ui";
import { ImagePlus } from "lucide-react";
import { putToStorage, useStudentApi } from "@/lib/student-api";

const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_MB = 10;

/** Upload a revised sketch: drop or browse, preview, add a note, then save. */
export function RevisionUpload({
  questionId,
  remaining,
  onSaved,
  onCancel,
}: {
  questionId: string;
  /** Uploads still allowed (shown to the student). */
  remaining: number;
  onSaved: (work: SketchWorkView) => void;
  onCancel?: () => void;
}) {
  const api = useStudentApi();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ids = React.useId();

  React.useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function choose(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!TYPES.includes(f.type)) {
      setError("Choose a PNG, JPEG or WebP image.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`Images must be ${MAX_MB} MB or smaller.`);
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setDescription("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function save() {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const presigned = await api.presignRevision(questionId, file);
      await putToStorage(presigned.url, file);
      const work = await api.saveRevision(questionId, file, presigned.key, description);
      reset();
      onSaved(work);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't upload. Check your connection and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-10 text-center",
            dragging
              ? "border-primary-400 bg-primary-50 dark:bg-primary-500/10"
              : "border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-white/[0.02]",
          )}
        >
          <ImagePlus size={28} aria-hidden="true" className="text-neutral-400" />
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            Drag a photo of your sketch here, or
          </p>
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            Choose a file
          </Button>
          <input
            ref={inputRef}
            id={`${ids}-file`}
            type="file"
            accept={TYPES.join(",")}
            className="sr-only"
            aria-label="Choose a sketch image"
            onChange={(e) => choose(e.target.files?.[0])}
          />
          <p className="text-xs text-neutral-500">
            PNG, JPEG or WebP, up to {MAX_MB} MB · {remaining} upload{remaining === 1 ? "" : "s"}{" "}
            left
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-800 dark:text-white/90">Preview</p>
          <img
            src={preview!}
            alt="Preview of the sketch to upload"
            className="max-h-96 self-start rounded-md"
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${ids}-desc`}
              className="text-sm text-neutral-700 dark:text-neutral-300"
            >
              Describe what you changed (optional)
            </label>
            <textarea
              id={`${ids}-desc`}
              rows={2}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Fixed the perspective of the platform and added shadows"
              className="w-full rounded-md border border-neutral-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Uploading…" : "Save upload"}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={saving}>
              Choose another
            </Button>
          </div>
        </div>
      )}
      <FieldError>{error}</FieldError>
      {onCancel && !file ? (
        <div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      ) : null}
    </div>
  );
}
