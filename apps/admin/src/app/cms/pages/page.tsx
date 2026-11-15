"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import { Button, Input } from "@examora/ui";
import type { CmsContentVersionDto, CmsPageDto, CmsPageType } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { WorkflowActions, WorkflowStatusBadge } from "@/components/cms/workflow-actions";
import { VersionHistory } from "@/components/cms/version-history";
import { useCmsApi } from "@/lib/cms-api";

function CmsPagesContent() {
  const api = useCmsApi();
  const [pages, setPages] = React.useState<CmsPageDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<CmsPageDto | null>(null);
  const [versions, setVersions] = React.useState<CmsContentVersionDto[]>([]);

  const [pageType, setPageType] = React.useState<CmsPageType>("LANDING");
  const [slug, setSlug] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");

  const loadList = React.useCallback(() => {
    setLoading(true);
    api.pages
      .list({ pageSize: 50 })
      .then((res) => setPages(res.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSelected = React.useCallback((id: string) => {
    api.pages
      .get(id)
      .then(setSelected)
      .catch(() => undefined);
    api.pages
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
      const created = await api.pages.create({ pageType, slug, title, body });
      setSlug("");
      setTitle("");
      setBody("");
      loadList();
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create page");
    }
  }

  async function handleSaveEdit(patch: Partial<CmsPageDto>) {
    if (!selected) return;
    setError(null);
    try {
      const updated = await api.pages.update(selected.id, {
        title: patch.title ?? selected.title,
        body: patch.body ?? selected.body,
        seoTitle: patch.seoTitle ?? selected.seoTitle ?? undefined,
        seoDescription: patch.seoDescription ?? selected.seoDescription ?? undefined,
      });
      setSelected(updated);
      loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save page");
    }
  }

  return (
    <main>
      <h1 className="text-xl font-semibold text-neutral-800 dark:text-white/90">
        Landing & Static Pages
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Draft → Review → Approval → Publish → Archive, with version history and scheduling
        (ADR-0022).
      </p>
      {error ? <p className="mt-3 text-sm text-error-600 dark:text-error-400">{error}</p> : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <form
            onSubmit={handleCreate}
            className="flex flex-col gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
          >
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-white/90">New page</h2>
            <select
              className="rounded border border-neutral-300 dark:border-neutral-700 px-2 py-1.5 text-sm"
              value={pageType}
              onChange={(e) => setPageType(e.target.value as CmsPageType)}
            >
              <option value="LANDING">Landing page</option>
              <option value="STATIC">Static page</option>
            </select>
            <Input
              placeholder="slug (e.g. about-us)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <textarea
              className="rounded border border-neutral-300 dark:border-neutral-700 px-2 py-1.5 text-sm"
              placeholder="Body"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
            <Button type="submit" variant="primary">
              Create draft
            </Button>
          </form>

          {loading ? (
            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
          ) : null}
          <ul className="mt-4 flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            {pages.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-neutral-50 dark:hover:bg-white/[0.03] ${
                    selectedId === p.id ? "bg-neutral-50 dark:bg-white/[0.03]" : ""
                  }`}
                >
                  <span>
                    <span className="font-medium text-neutral-900 dark:text-white/90">
                      {p.title}
                    </span>
                    <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                      /{p.slug}
                    </span>
                  </span>
                  <WorkflowStatusBadge status={p.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          {selected ? (
            <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-800 dark:text-white/90">
                  {selected.title}{" "}
                  <span className="text-neutral-400 dark:text-neutral-500">
                    (v{selected.version})
                  </span>
                </h2>
                {selected.status === "PUBLISHED" ? (
                  <a
                    href={`${process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000"}/pages/${selected.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    View live ↗
                  </a>
                ) : null}
              </div>

              <WorkflowActions
                status={selected.status}
                scheduledPublishAt={selected.scheduledPublishAt}
                scheduledUnpublishAt={selected.scheduledUnpublishAt}
                onTransition={async (target) => {
                  setSelected(await api.pages.transition(selected.id, target));
                  loadList();
                  loadSelected(selected.id);
                }}
                onSchedulePublish={async (at) => {
                  setSelected(await api.pages.schedulePublish(selected.id, at));
                }}
                onScheduleUnpublish={async (at) => {
                  setSelected(await api.pages.scheduleUnpublish(selected.id, at));
                }}
              />

              {selected.status === "DRAFT" ? (
                <div className="flex flex-col gap-2 border-t border-neutral-100 dark:border-neutral-800 pt-3">
                  <Input
                    defaultValue={selected.title}
                    onBlur={(e) =>
                      e.target.value !== selected.title && handleSaveEdit({ title: e.target.value })
                    }
                    placeholder="Title"
                  />
                  <textarea
                    className="rounded border border-neutral-300 dark:border-neutral-700 px-2 py-1.5 text-sm"
                    rows={5}
                    defaultValue={selected.body}
                    onBlur={(e) =>
                      e.target.value !== selected.body && handleSaveEdit({ body: e.target.value })
                    }
                  />
                  <Input
                    defaultValue={selected.seoTitle ?? ""}
                    placeholder="SEO title"
                    onBlur={(e) => handleSaveEdit({ seoTitle: e.target.value })}
                  />
                  <Input
                    defaultValue={selected.seoDescription ?? ""}
                    placeholder="SEO description"
                    onBlur={(e) => handleSaveEdit({ seoDescription: e.target.value })}
                  />
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">
                    Fields save automatically when you click away.
                  </p>
                </div>
              ) : (
                <p className="whitespace-pre-wrap border-t border-neutral-100 dark:border-neutral-800 pt-3 text-sm text-neutral-600 dark:text-neutral-400">
                  {selected.body}
                </p>
              )}

              <div className="border-t border-neutral-100 dark:border-neutral-800 pt-3">
                <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Version history
                </h3>
                <VersionHistory
                  versions={versions}
                  onCompare={(from, to) => api.pages.compareVersions(selected.id, from, to)}
                  onRestore={async (v) => {
                    setSelected(await api.pages.restoreVersion(selected.id, v));
                    loadSelected(selected.id);
                    loadList();
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Select a page to view and edit it.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function CmsPagesPage() {
  return (
    <RequirePermission permission="cms:manage">
      <CmsPagesContent />
    </RequirePermission>
  );
}
