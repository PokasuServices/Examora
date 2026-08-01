"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import { Button } from "@examora/ui";
import type { CmsAssetDto } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { useCmsApi } from "@/lib/cms-api";

const SCAN_STYLES: Record<CmsAssetDto["scanStatus"], string> = {
  PENDING: "bg-neutral-200 text-neutral-600",
  CLEAN: "bg-success-500/10 text-success-600",
  INFECTED: "bg-error-500/10 text-error-600",
  FAILED: "bg-error-500/10 text-error-600",
};

function CmsMediaContent() {
  const api = useCmsApi();
  const [assets, setAssets] = React.useState<CmsAssetDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadList = React.useCallback(() => {
    setLoading(true);
    api.assets
      .list({ pageSize: 100 })
      .then((res) => setAssets(res.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    loadList();
  }, [loadList]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
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
      loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await api.assets.remove(id);
      loadList();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not delete — still referenced by content",
      );
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-heading">Media Library</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Upload once, reuse across pages/banners. Every upload is quarantined until scanned CLEAN
        (ADR-0022 §5).
      </p>
      {error ? <p className="mt-3 text-sm text-error-600">{error}</p> : null}

      <div className="mt-6 flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/pdf"
          onChange={(e) => void handleUpload(e)}
          disabled={uploading}
          className="text-sm"
        />
        {uploading ? <span className="text-sm text-neutral-500">Uploading…</span> : null}
      </div>

      {loading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}

      {!loading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3"
            >
              <p className="truncate text-sm font-medium text-neutral-900" title={asset.fileName}>
                {asset.fileName}
              </p>
              <span
                className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${SCAN_STYLES[asset.scanStatus]}`}
              >
                {asset.scanStatus}
              </span>
              <p className="text-xs text-neutral-500">
                {(asset.sizeBytes / 1024).toFixed(0)} KB · used {asset.usageCount}×
              </p>
              <p className="text-xs text-neutral-400">{asset.uploadedByEmail}</p>
              <Button
                variant="ghost"
                size="sm"
                disabled={asset.usageCount > 0}
                onClick={() => void handleDelete(asset.id)}
                title={asset.usageCount > 0 ? "Still referenced by content" : undefined}
              >
                Delete
              </Button>
            </div>
          ))}
          {assets.length === 0 ? (
            <p className="text-sm text-neutral-500">No assets uploaded yet.</p>
          ) : null}
        </div>
      ) : null}
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
