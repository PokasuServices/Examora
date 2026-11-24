"use client";

import * as React from "react";
import { ImageUp } from "lucide-react";
import { Button } from "@examora/ui";
import { putToStorage, useStudentApi } from "@/lib/student-api";

/** UPLOAD questions: pick a photo/scan of the sketch and attach it as the answer. */
export function SketchUpload({
  attemptId,
  questionId,
  criteria,
  uploadedRef,
  onUploaded,
}: {
  attemptId: string;
  questionId: string;
  criteria: string[];
  uploadedRef: string | null;
  onUploaded: (ref: string) => void;
}) {
  const api = useStudentApi();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function upload(file: File) {
    setError(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Upload a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("The image must be 10 MB or smaller.");
      return;
    }
    setBusy(true);
    try {
      const presign = await api.presignSketch(attemptId, questionId, file);
      await putToStorage(presign.url, file);
      const { ref } = await api.confirmSketch(attemptId, questionId, file, presign.key);
      setPreview(URL.createObjectURL(file));
      onUploaded(ref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div
        className="flex flex-col items-center gap-3 rounded-md border-2 border-dashed border-neutral-300 px-4 py-8 text-center dark:border-neutral-700"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) void upload(file);
        }}
      >
        {preview ? (
          // Local preview of what was just uploaded (the stored copy is virus-scanned first).
          <img
            src={preview}
            alt="Your uploaded sketch"
            className="max-h-64 rounded border border-neutral-200 object-contain"
          />
        ) : (
          <ImageUp size={32} aria-hidden="true" className="text-neutral-400" />
        )}
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {uploadedRef
            ? "Sketch uploaded. You can replace it until you submit."
            : "Drop a photo or scan of your sketch here"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          id={`sketch-${questionId}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Uploading…" : uploadedRef ? "Replace image" : "Choose image"}
        </Button>
        <p className="text-xs text-neutral-500">PNG, JPEG or WebP, up to 10 MB</p>
        {error ? (
          <p role="alert" className="text-sm text-danger-600">
            {error}
          </p>
        ) : null}
      </div>
      {criteria.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-neutral-800 dark:text-white/90">
            You&rsquo;ll be marked on
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {criteria.map((c) => (
              <li
                key={c}
                className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700 dark:bg-white/5 dark:text-neutral-300"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
