"use client";

import * as React from "react";
import { FileText, Upload } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { CmsAssetDto } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { useCmsApi } from "@/lib/cms-api";

const SCAN_TONE: Record<CmsAssetDto["scanStatus"], ChipTone> = {
  PENDING: "warning",
  CLEAN: "success",
  INFECTED: "danger",
  FAILED: "danger",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CmsMediaContent() {
  const api = useCmsApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [assets, setAssets] = React.useState<CmsAssetDto[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<CmsAssetDto | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api.assets
      .list({ pageSize: 100 })
      .then((res) => {
        setAssets(res.items);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Upload mechanics (presign -> PUT -> confirm) are unchanged from the original implementation.
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const presign = await api.assets.presign({
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      await fetch(presign.url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      await api.assets.confirm({
        storageKey: presign.key,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      load();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await api.assets.remove(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : "Could not delete — still referenced by content",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Media library"
        subtitle="Upload once, reuse across pages and banners. Every upload is quarantined until scanned clean."
      />

      <Card>
        <label
          htmlFor="asset-upload"
          className="flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-neutral-200 text-neutral-500 hover:border-primary-300 hover:bg-primary-50/30"
        >
          <Upload size={20} strokeWidth={1.75} aria-hidden="true" />
          <span className="text-sm font-medium">
            {uploading ? "Uploading…" : "Click to upload an asset"}
          </span>
          <span className="text-xs text-neutral-400">PNG, JPEG, GIF, WEBP, SVG, or PDF</span>
        </label>
        <input
          id="asset-upload"
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/pdf"
          onChange={(e) => void handleUpload(e)}
          disabled={uploading}
          className="sr-only"
        />
        {uploadError ? <p className="mt-2 text-sm text-danger-600">{uploadError}</p> : null}
      </Card>

      {status === "loading" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-card" />
          ))}
        </div>
      ) : status === "error" ? (
        <Card density="compact">
          <RetryInline message="Couldn't load the media library" onRetry={load} />
        </Card>
      ) : assets.length === 0 ? (
        <Card density="compact">
          <EmptyState
            icon={FileText}
            heading="No assets yet"
            body="Upload an image or PDF to get started."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {assets.map((asset) => (
            <Card key={asset.id} density="compact" className="flex flex-col gap-3">
              <div className="flex h-20 items-center justify-center rounded-md bg-neutral-100">
                <FileText
                  size={24}
                  strokeWidth={1.5}
                  className="text-neutral-400"
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-800" title={asset.fileName}>
                  {asset.fileName}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {formatSize(asset.sizeBytes)} · used {asset.usageCount}×
                </p>
                <p className="mt-0.5 truncate text-xs text-neutral-400">{asset.uploadedByEmail}</p>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-2">
                <Chip tone={SCAN_TONE[asset.scanStatus]}>{statusLabel(asset.scanStatus)}</Chip>
                <button
                  type="button"
                  disabled={asset.usageCount > 0}
                  onClick={() => setDeleteTarget(asset)}
                  title={asset.usageCount > 0 ? "Still referenced by content" : undefined}
                  className="text-xs font-medium text-danger-600 hover:underline disabled:pointer-events-none disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this asset?"
        message={
          deleteTarget ? (
            <>
              Delete <span className="font-medium text-neutral-800">{deleteTarget.fileName}</span>?
              This can&rsquo;t be undone.
            </>
          ) : null
        }
        confirmLabel="Delete"
        tone="danger"
        submitting={deleting}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}

export default function CmsMediaPage() {
  return (
    <RequirePermission permission="cms:manage">
      <CmsMediaContent />
    </RequirePermission>
  );
}
