"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { CmsAssetDto } from "@examora/types";
import { useCmsApi } from "@/lib/cms-api";

type Status = "loading" | "ready" | "error";

export function useMediaLibrary() {
  const api = useCmsApi();
  const [status, setStatus] = React.useState<Status>("loading");
  const [assets, setAssets] = React.useState<CmsAssetDto[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

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

  /** Same presign → PUT-to-storage → confirm flow already proven in apps/admin — not reimplemented, just restyled. */
  async function upload(file: File, altText?: string): Promise<boolean> {
    setUploading(true);
    setUploadError(null);
    try {
      const presign = await api.assets.presign({
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        altText,
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
        altText,
      });
      load();
      return true;
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed.");
      return false;
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string): Promise<boolean> {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await api.assets.remove(id);
      load();
      return true;
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : "Could not delete — still referenced by content.",
      );
      return false;
    } finally {
      setDeletingId(null);
    }
  }

  async function download(id: string): Promise<void> {
    const { url } = await api.assets.getDownloadUrl(id);
    window.open(url, "_blank", "noreferrer");
  }

  return {
    status,
    assets,
    uploading,
    uploadError,
    deleteError,
    deletingId,
    upload,
    remove,
    download,
    retry: load,
  };
}
