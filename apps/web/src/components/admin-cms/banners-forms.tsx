"use client";

import * as React from "react";
import type { CmsAssetDto, CmsBannerDto } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { SelectField } from "@/components/ui/select-field";

function assetOptions(assets: CmsAssetDto[]): { value: string; label: string }[] {
  return [
    { value: "", label: "No image" },
    ...assets
      .filter((a) => a.scanStatus === "CLEAN")
      .map((a) => ({ value: a.id, label: a.fileName })),
  ];
}

export function BannerCreateForm({
  assets,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  assets: CmsAssetDto[];
  submitting: boolean;
  error: string | null;
  onSubmit: (input: {
    title: string;
    placement: string;
    imageAssetId?: string;
    linkUrl?: string;
  }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [placement, setPlacement] = React.useState("");
  const [imageAssetId, setImageAssetId] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title,
          placement,
          imageAssetId: imageAssetId || undefined,
          linkUrl: linkUrl || undefined,
        });
      }}
      className="flex flex-col gap-4 rounded-md border border-neutral-100 bg-neutral-50/50 p-4"
    >
      <h3 className="font-heading text-sm font-semibold text-neutral-900">New banner</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="banner-title">Title</Label>
          <Input
            id="banner-title"
            required
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="banner-placement">Placement</Label>
          <Input
            id="banner-placement"
            required
            placeholder="e.g. HOMEPAGE_TOP"
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="banner-asset"
          label="Image (from Media Library)"
          value={imageAssetId}
          options={assetOptions(assets)}
          onChange={setImageAssetId}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="banner-link">Link URL</Label>
          <Input
            id="banner-link"
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </div>
      </div>
      <FieldError>{error}</FieldError>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || !title.trim() || !placement.trim()}>
          {submitting ? "Creating…" : "Create banner"}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-neutral-600 hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function BannerFieldsForm({
  banner,
  assets,
  editable,
  submitting,
  error,
  onSave,
}: {
  banner: CmsBannerDto;
  assets: CmsAssetDto[];
  editable: boolean;
  submitting: boolean;
  error: string | null;
  onSave: (input: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = React.useState(banner.title);
  const [placement, setPlacement] = React.useState(banner.placement);
  const [imageAssetId, setImageAssetId] = React.useState(banner.imageAssetId ?? "");
  const [linkUrl, setLinkUrl] = React.useState(banner.linkUrl ?? "");

  React.useEffect(() => {
    setTitle(banner.title);
    setPlacement(banner.placement);
    setImageAssetId(banner.imageAssetId ?? "");
    setLinkUrl(banner.linkUrl ?? "");
  }, [banner]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          title,
          placement,
          imageAssetId: imageAssetId || null,
          linkUrl: linkUrl || undefined,
        });
      }}
      className="flex flex-col gap-4"
    >
      {!editable ? (
        <p className="rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-500">
          Only content in Draft can be edited — send it back to draft first.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="banner-edit-title">Title</Label>
          <Input
            id="banner-edit-title"
            disabled={!editable}
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="banner-edit-placement">Placement</Label>
          <Input
            id="banner-edit-placement"
            disabled={!editable}
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="banner-edit-asset"
          label="Image (from Media Library)"
          value={imageAssetId}
          options={assetOptions(assets)}
          onChange={setImageAssetId}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="banner-edit-link">Link URL</Label>
          <Input
            id="banner-edit-link"
            type="url"
            disabled={!editable}
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </div>
      </div>
      <FieldError>{error}</FieldError>
      {editable ? (
        <div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
