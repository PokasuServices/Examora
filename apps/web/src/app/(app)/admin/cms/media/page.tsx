"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import type { CmsAssetDto } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { CmsShell } from "@/components/admin-cms/cms-shell";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ChipTone } from "@/components/ui/chip";
import { useMediaLibrary } from "@/components/admin-cms/use-media-library";

const SCAN_ICON: Record<
  CmsAssetDto["scanStatus"],
  React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
    "aria-hidden"?: boolean;
  }>
> = {
  PENDING: Clock,
  CLEAN: CheckCircle2,
  INFECTED: AlertTriangle,
  FAILED: XCircle,
};
const SCAN_TONE: Record<CmsAssetDto["scanStatus"], ChipTone> = {
  PENDING: "neutral",
  CLEAN: "success",
  INFECTED: "danger",
  FAILED: "danger",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AssetCard({
  asset,
  deleting,
  onDelete,
  onDownload,
}: {
  asset: CmsAssetDto;
  deleting: boolean;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const ScanIcon = SCAN_ICON[asset.scanStatus];

  return (
    <Card density="compact" className="flex flex-col gap-3">
      <div className="flex h-24 items-center justify-center rounded-md bg-neutral-100">
        <FileText size={28} strokeWidth={1.5} className="text-neutral-400" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-800" title={asset.fileName}>
          {asset.fileName}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {formatSize(asset.sizeBytes)} · {asset.mimeType}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">
          {asset.uploadedByEmail} · {new Date(asset.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Chip tone={SCAN_TONE[asset.scanStatus]} className="gap-1">
          <ScanIcon size={12} strokeWidth={2} aria-hidden={true} />
          {asset.scanStatus === "CLEAN"
            ? "Clean"
            : asset.scanStatus === "PENDING"
              ? "Scanning…"
              : statusLabelFallback(asset.scanStatus)}
        </Chip>
        <span className="text-xs text-neutral-400">used {asset.usageCount}×</span>
      </div>
      <div className="flex items-center gap-3 border-t border-neutral-100 pt-2">
        {asset.scanStatus === "CLEAN" ? (
          <button
            type="button"
            onClick={onDownload}
            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
          >
            <Download size={12} strokeWidth={2} aria-hidden="true" />
            Download
          </button>
        ) : null}
        <button
          type="button"
          disabled={asset.usageCount > 0 || deleting}
          onClick={onDelete}
          title={asset.usageCount > 0 ? "Still referenced by content" : undefined}
          className="ml-auto flex items-center gap-1 text-xs font-medium text-danger-600 hover:underline disabled:pointer-events-none disabled:opacity-40"
        >
          <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Card>
  );
}

function statusLabelFallback(status: string): string {
  return status[0] + status.slice(1).toLowerCase();
}

function MediaLibraryContent() {
  const {
    status,
    assets,
    uploading,
    uploadError,
    deleteError,
    deletingId,
    upload,
    remove,
    download,
    retry,
  } = useMediaLibrary();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    await upload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function confirmDelete(): Promise<void> {
    if (!confirmDeleteId) return;
    const ok = await remove(confirmDeleteId);
    if (ok) setConfirmDeleteId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-neutral-900">Media Library</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Upload once, reuse across pages and banners. Every upload is quarantined until scanned
          clean.
        </p>
      </div>

      <Card>
        <label
          htmlFor="asset-upload"
          className="flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-neutral-200 text-neutral-500 hover:border-primary-300 hover:bg-primary-50/30"
        >
          <Upload size={20} strokeWidth={1.75} aria-hidden="true" />
          <span className="text-sm font-medium">
            {uploading ? "Uploading…" : "Click to upload an asset"}
          </span>
          <span className="text-xs text-neutral-400">
            PNG, JPEG, GIF, WEBP, SVG, or PDF — up to 10 MB
          </span>
        </label>
        <input
          id="asset-upload"
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/pdf"
          onChange={(e) => void handleFileChange(e)}
          disabled={uploading}
          className="sr-only"
        />
        {uploadError ? <p className="mt-2 text-sm text-danger-600">{uploadError}</p> : null}
        {deleteError ? <p className="mt-2 text-sm text-danger-600">{deleteError}</p> : null}
      </Card>

      {status === "loading" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-card" />
          ))}
        </div>
      ) : status === "error" ? (
        <Card>
          <RetryInline message="Couldn't load the media library" onRetry={retry} />
        </Card>
      ) : assets.length === 0 ? (
        <Card>
          <EmptyState heading="No assets yet" body="Upload an image or PDF to get started." />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              deleting={deletingId === asset.id}
              onDelete={() => setConfirmDeleteId(asset.id)}
              onDownload={() => void download(asset.id)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete this asset?"
        message="This can't be undone."
        confirmLabel="Delete"
        tone="danger"
        submitting={deletingId !== null}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}

export default function MediaLibraryPage() {
  return (
    <RequirePermission permission="cms:manage">
      <CmsShell>
        <MediaLibraryContent />
      </CmsShell>
    </RequirePermission>
  );
}
