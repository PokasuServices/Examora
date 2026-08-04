import { AlertCircle, Download, File as FileIcon, Loader2, Trash2 } from "lucide-react";
import type { SubmissionFile } from "@examora/types";
import { Chip, type ChipTone } from "@/components/ui/chip";
import type { UploadItem } from "./types";

const SCAN_LABEL: Record<SubmissionFile["scanStatus"], string> = {
  PENDING: "Scanning…",
  CLEAN: "Ready",
  INFECTED: "Blocked (infected)",
  FAILED: "Scan failed",
};
const SCAN_TONE: Record<SubmissionFile["scanStatus"], ChipTone> = {
  PENDING: "neutral",
  CLEAN: "success",
  INFECTED: "danger",
  FAILED: "danger",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SubmissionFileList({
  files,
  uploads,
  canModify,
  onRemove,
  onDownload,
}: {
  files: SubmissionFile[];
  uploads: UploadItem[];
  canModify: boolean;
  onRemove: (fileId: string) => void;
  onDownload: (fileId: string) => void;
}) {
  if (files.length === 0 && uploads.length === 0) {
    return <p className="text-sm text-neutral-400">No files uploaded yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {uploads.map((u) => (
        <li
          key={u.localId}
          className="flex items-center gap-3 rounded-md border border-neutral-200 px-3 py-2.5 text-sm"
        >
          <FileIcon
            size={16}
            strokeWidth={1.75}
            className="shrink-0 text-neutral-400"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate">{u.fileName}</span>
          {u.status === "error" ? (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-error-600">
              <AlertCircle size={13} strokeWidth={2} aria-hidden="true" />
              {u.error}
            </span>
          ) : u.status === "confirming" ? (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-400">
              <Loader2
                size={13}
                strokeWidth={2}
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Finalizing…
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-2">
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-200">
                <span
                  className="block h-full rounded-full bg-primary-600 transition-[width] duration-150"
                  style={{ width: `${u.progress}%` }}
                />
              </span>
              <span className="w-8 text-right text-xs tabular-nums text-neutral-400">
                {u.progress}%
              </span>
            </span>
          )}
        </li>
      ))}

      {files.map((f) => (
        <li
          key={f.id}
          className="flex items-center gap-3 rounded-md border border-neutral-200 px-3 py-2.5 text-sm"
        >
          <FileIcon
            size={16}
            strokeWidth={1.75}
            className="shrink-0 text-neutral-400"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-neutral-800">{f.fileName}</span>
            <span className="text-xs text-neutral-400">{formatBytes(f.sizeBytes)}</span>
          </span>
          <Chip tone={SCAN_TONE[f.scanStatus]}>{SCAN_LABEL[f.scanStatus]}</Chip>
          {f.scanStatus === "CLEAN" ? (
            <button
              type="button"
              onClick={() => onDownload(f.id)}
              aria-label={`Download ${f.fileName}`}
              title="Download"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <Download size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
          {canModify ? (
            <button
              type="button"
              onClick={() => onRemove(f.id)}
              aria-label={`Remove ${f.fileName}`}
              title="Remove"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
