"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@examora/ui";
import { COMMUNITY_ATTACHMENT_RULES } from "./types";

interface RejectedFile {
  fileName: string;
  reason: string;
}

/** Client-side pre-validation mirrors CommunityAttachmentsService.assertFileRules — the server still re-validates independently. */
export function AttachmentUploadZone({
  disabled,
  onFilesAccepted,
}: {
  disabled?: boolean;
  onFilesAccepted: (files: File[]) => void;
}) {
  const [dragOver, setDragOver] = React.useState(false);
  const [rejected, setRejected] = React.useState<RejectedFile[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function validate(files: File[]): File[] {
    const accepted: File[] = [];
    const nextRejected: RejectedFile[] = [];

    for (const file of files) {
      if (!COMMUNITY_ATTACHMENT_RULES.allowedMimeTypes.includes(file.type)) {
        nextRejected.push({ fileName: file.name, reason: "File type not allowed" });
        continue;
      }
      if (file.size > COMMUNITY_ATTACHMENT_RULES.maxFileSizeMb * 1024 * 1024) {
        nextRejected.push({
          fileName: file.name,
          reason: `Exceeds ${COMMUNITY_ATTACHMENT_RULES.maxFileSizeMb}MB limit`,
        });
        continue;
      }
      accepted.push(file);
    }

    setRejected(nextRejected);
    return accepted;
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const accepted = validate(Array.from(fileList));
    if (accepted.length > 0) onFilesAccepted(accepted);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-6 text-center transition-colors",
          disabled
            ? "cursor-not-allowed border-neutral-200 text-neutral-300"
            : dragOver
              ? "cursor-pointer border-primary-500 bg-primary-50"
              : "cursor-pointer border-neutral-200 text-neutral-500 hover:border-primary-300 hover:bg-neutral-50",
        )}
      >
        <UploadCloud size={22} strokeWidth={1.5} aria-hidden="true" />
        <p className="text-sm font-medium">
          {disabled
            ? "Sign in as the author to attach files"
            : "Drag files here or click to browse"}
        </p>
        {!disabled ? (
          <p className="text-xs text-neutral-400">
            Images, PDF, Word or text · up to {COMMUNITY_ATTACHMENT_RULES.maxFileSizeMb}MB each
          </p>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={disabled}
          accept={COMMUNITY_ATTACHMENT_RULES.allowedMimeTypes.join(",")}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
          className="sr-only"
        />
      </div>
      {rejected.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1">
          {rejected.map((r, i) => (
            <li key={i} className="text-xs text-danger-600">
              {r.fileName}: {r.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
