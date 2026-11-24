"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import { MEDIA_SCHEME } from "@examora/types";
import { Button, Input, Label } from "@examora/ui";
import { adminMediaUrl, useMediaApi } from "@/lib/media-api";

type Kind = "image" | "video";

/**
 * Edits an image/video reference: upload a file (stored as "media:<id>") or
 * paste an https URL (a YouTube/Vimeo link works for videos). Shows a preview,
 * and while an uploaded image is being virus-scanned, polls until it's ready.
 */
export function MediaField({
  id,
  label,
  kind,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  kind: Kind;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const api = useMediaApi();
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [scan, setScan] = React.useState<"PENDING" | "CLEAN" | "INFECTED" | "FAILED" | null>(null);

  // Poll the scan status of an uploaded file until it settles.
  React.useEffect(() => {
    if (!value.startsWith(MEDIA_SCHEME)) {
      setScan(null);
      return;
    }
    const assetId = value.slice(MEDIA_SCHEME.length);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      apiRef.current
        .get(assetId)
        .then((asset) => {
          if (cancelled) return;
          setScan(asset.scanStatus);
          if (asset.scanStatus === "PENDING") timer = setTimeout(check, 2000);
        })
        .catch(() => {
          if (!cancelled) setScan(null);
        });
    };
    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [value]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const asset = await api.upload(file);
      onChange(asset.ref);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const url = adminMediaUrl(value);
  const isUpload = value.startsWith(MEDIA_SCHEME);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder={
            kind === "image" ? "https://… or upload" : "YouTube/Vimeo link, https://… or upload"
          }
          className="min-w-[240px] flex-1"
        />
        <input
          ref={fileRef}
          type="file"
          accept={
            kind === "image" ? "image/png,image/jpeg,image/gif,image/webp" : "video/mp4,video/webm"
          }
          onChange={(e) => void onFile(e)}
          className="sr-only"
          id={`${id}-file`}
          tabIndex={-1}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? "Uploading…" : "Upload"}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            Remove
          </Button>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-danger-600 dark:text-danger-400">
          {error}
        </p>
      ) : null}
      {isUpload && scan === "PENDING" ? (
        <p className="text-xs text-warning-700 dark:text-warning-300">Virus scan in progress…</p>
      ) : null}
      {isUpload && (scan === "INFECTED" || scan === "FAILED") ? (
        <p role="alert" className="text-xs text-danger-600 dark:text-danger-400">
          This file {scan === "INFECTED" ? "failed the virus scan" : "couldn't be scanned"} and
          won&rsquo;t be shown. Upload another.
        </p>
      ) : null}
      {url && kind === "image" && (!isUpload || scan === "CLEAN") ? (
        // Plain <img>: media URLs redirect to short-lived storage URLs.
        <img
          src={url}
          alt=""
          className="mt-1 max-h-40 max-w-xs rounded border border-neutral-200 object-contain dark:border-neutral-800"
        />
      ) : null}
      {value && !url ? (
        <p className="text-xs text-danger-600 dark:text-danger-400">
          Use an https:// link or upload a file.
        </p>
      ) : null}
    </div>
  );
}
