"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import { Button, Input } from "@examora/ui";
import type { CmsAssetDto, CmsBannerDto, CmsContentVersionDto } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { WorkflowActions, WorkflowStatusBadge } from "@/components/cms/workflow-actions";
import { VersionHistory } from "@/components/cms/version-history";
import { useCmsApi } from "@/lib/cms-api";

function CmsBannersContent() {
  const api = useCmsApi();
  const [items, setItems] = React.useState<CmsBannerDto[]>([]);
  const [assets, setAssets] = React.useState<CmsAssetDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<CmsBannerDto | null>(null);
  const [versions, setVersions] = React.useState<CmsContentVersionDto[]>([]);

  const [title, setTitle] = React.useState("");
  const [placement, setPlacement] = React.useState("HOMEPAGE_TOP");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [imageAssetId, setImageAssetId] = React.useState("");

  const cleanAssets = assets.filter((a) => a.scanStatus === "CLEAN");

  const loadList = React.useCallback(() => {
    setLoading(true);
    Promise.all([api.banners.list({ pageSize: 50 }), api.assets.list({ pageSize: 100 })])
      .then(([banners, mediaAssets]) => {
        setItems(banners.items);
        setAssets(mediaAssets.items);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSelected = React.useCallback((id: string) => {
    api.banners
      .get(id)
      .then(setSelected)
      .catch(() => undefined);
    api.banners
      .listVersions(id)
      .then(setVersions)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    loadList();
  }, [loadList]);

  React.useEffect(() => {
    if (selectedId) loadSelected(selectedId);
  }, [selectedId, loadSelected]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.banners.create({
        title,
        placement,
        linkUrl: linkUrl || undefined,
        imageAssetId: imageAssetId || undefined,
      });
      setTitle("");
      setLinkUrl("");
      setImageAssetId("");
      loadList();
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create banner");
    }
  }

  async function handleSaveEdit(patch: Partial<CmsBannerDto>) {
    if (!selected) return;
    setError(null);
    try {
      const updated = await api.banners.update(selected.id, {
        title: patch.title ?? selected.title,
        linkUrl: patch.linkUrl ?? selected.linkUrl ?? undefined,
        placement: patch.placement ?? selected.placement,
        imageAssetId: "imageAssetId" in patch ? patch.imageAssetId : undefined,
      });
      setSelected(updated);
      loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save banner");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-heading">Banners</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Draft → Review → Approval → Publish → Archive, backed by a reusable media library image
        (ADR-0022 §2, §5).
      </p>
      {error ? <p className="mt-3 text-sm text-error-600">{error}</p> : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <form
            onSubmit={handleCreate}
            className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-neutral-800">New banner</h2>
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <Input
              placeholder='Placement (e.g. "HOMEPAGE_TOP")'
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
              required
            />
            <Input
              placeholder="Link URL (optional)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <select
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
              value={imageAssetId}
              onChange={(e) => setImageAssetId(e.target.value)}
            >
              <option value="">No image</option>
              {cleanAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fileName}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-400">
              Upload images in the{" "}
              <a href="/cms/media" className="text-primary-600 hover:underline">
                Media Library
              </a>{" "}
              first.
            </p>
            <Button type="submit" variant="primary">
              Create draft
            </Button>
          </form>

          {loading ? <p className="mt-4 text-sm text-neutral-500">Loading…</p> : null}
          <ul className="mt-4 flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-neutral-50 ${
                    selectedId === item.id ? "bg-neutral-50" : ""
                  }`}
                >
                  <span>
                    <span className="font-medium text-neutral-900">{item.title}</span>
                    <span className="ml-2 text-xs text-neutral-500">{item.placement}</span>
                  </span>
                  <WorkflowStatusBadge status={item.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          {selected ? (
            <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-neutral-800">
                {selected.title} <span className="text-neutral-400">(v{selected.version})</span>
              </h2>

              <WorkflowActions
                status={selected.status}
                scheduledPublishAt={selected.scheduledPublishAt}
                scheduledUnpublishAt={selected.scheduledUnpublishAt}
                onTransition={async (target) => {
                  setSelected(await api.banners.transition(selected.id, target));
                  loadList();
                  loadSelected(selected.id);
                }}
                onSchedulePublish={async (at) =>
                  setSelected(await api.banners.schedulePublish(selected.id, at))
                }
                onScheduleUnpublish={async (at) =>
                  setSelected(await api.banners.scheduleUnpublish(selected.id, at))
                }
              />

              {selected.status === "DRAFT" ? (
                <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3">
                  <Input
                    defaultValue={selected.title}
                    onBlur={(e) =>
                      e.target.value !== selected.title && handleSaveEdit({ title: e.target.value })
                    }
                    placeholder="Title"
                  />
                  <Input
                    defaultValue={selected.placement}
                    onBlur={(e) =>
                      e.target.value !== selected.placement &&
                      handleSaveEdit({ placement: e.target.value })
                    }
                    placeholder="Placement"
                  />
                  <Input
                    defaultValue={selected.linkUrl ?? ""}
                    placeholder="Link URL"
                    onBlur={(e) => handleSaveEdit({ linkUrl: e.target.value })}
                  />
                  <select
                    className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
                    defaultValue={selected.imageAssetId ?? ""}
                    onChange={(e) => handleSaveEdit({ imageAssetId: e.target.value || null })}
                  >
                    <option value="">No image</option>
                    {cleanAssets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.fileName}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-neutral-400">
                    Fields save automatically when you click away.
                  </p>
                </div>
              ) : (
                <p className="border-t border-neutral-100 pt-3 text-sm text-neutral-600">
                  {selected.linkUrl ? `Links to ${selected.linkUrl}` : "No link"} ·{" "}
                  {selected.imageAssetId ? "Has image" : "No image"}
                </p>
              )}

              <div className="border-t border-neutral-100 pt-3">
                <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                  Version history
                </h3>
                <VersionHistory
                  versions={versions}
                  onCompare={(from, to) => api.banners.compareVersions(selected.id, from, to)}
                  onRestore={async (v) => {
                    setSelected(await api.banners.restoreVersion(selected.id, v));
                    loadSelected(selected.id);
                    loadList();
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Select a banner to view and edit it.</p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function CmsBannersPage() {
  return (
    <RequirePermission permission="cms:manage">
      <CmsBannersContent />
    </RequirePermission>
  );
}
