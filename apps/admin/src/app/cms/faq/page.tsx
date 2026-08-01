"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import { Button, Input } from "@examora/ui";
import type { CmsContentVersionDto, CmsFaqItemDto } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { WorkflowActions, WorkflowStatusBadge } from "@/components/cms/workflow-actions";
import { VersionHistory } from "@/components/cms/version-history";
import { useCmsApi } from "@/lib/cms-api";

function CmsFaqContent() {
  const api = useCmsApi();
  const [items, setItems] = React.useState<CmsFaqItemDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<CmsFaqItemDto | null>(null);
  const [versions, setVersions] = React.useState<CmsContentVersionDto[]>([]);

  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [category, setCategory] = React.useState("");

  const loadList = React.useCallback(() => {
    setLoading(true);
    api.faq
      .list({ pageSize: 50 })
      .then((res) => setItems(res.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSelected = React.useCallback((id: string) => {
    api.faq
      .get(id)
      .then(setSelected)
      .catch(() => undefined);
    api.faq
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
      const created = await api.faq.create({ question, answer, category: category || undefined });
      setQuestion("");
      setAnswer("");
      setCategory("");
      loadList();
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create FAQ item");
    }
  }

  async function handleSaveEdit(patch: Partial<CmsFaqItemDto>) {
    if (!selected) return;
    setError(null);
    try {
      const updated = await api.faq.update(selected.id, {
        question: patch.question ?? selected.question,
        answer: patch.answer ?? selected.answer,
        category: patch.category ?? selected.category ?? undefined,
      });
      setSelected(updated);
      loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save FAQ item");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-heading">FAQ</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Draft → Review → Approval → Publish → Archive, with version history (ADR-0022).
      </p>
      {error ? <p className="mt-3 text-sm text-error-600">{error}</p> : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <form
            onSubmit={handleCreate}
            className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-neutral-800">New FAQ item</h2>
            <Input
              placeholder="Question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
            />
            <textarea
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
              placeholder="Answer"
              rows={3}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              required
            />
            <Input
              placeholder="Category (optional)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
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
                  <span className="font-medium text-neutral-900">{item.question}</span>
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
                {selected.question} <span className="text-neutral-400">(v{selected.version})</span>
              </h2>

              <WorkflowActions
                status={selected.status}
                scheduledPublishAt={selected.scheduledPublishAt}
                scheduledUnpublishAt={selected.scheduledUnpublishAt}
                onTransition={async (target) => {
                  setSelected(await api.faq.transition(selected.id, target));
                  loadList();
                  loadSelected(selected.id);
                }}
                onSchedulePublish={async (at) =>
                  setSelected(await api.faq.schedulePublish(selected.id, at))
                }
                onScheduleUnpublish={async (at) =>
                  setSelected(await api.faq.scheduleUnpublish(selected.id, at))
                }
              />

              {selected.status === "DRAFT" ? (
                <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3">
                  <Input
                    defaultValue={selected.question}
                    onBlur={(e) =>
                      e.target.value !== selected.question &&
                      handleSaveEdit({ question: e.target.value })
                    }
                    placeholder="Question"
                  />
                  <textarea
                    className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
                    rows={4}
                    defaultValue={selected.answer}
                    onBlur={(e) =>
                      e.target.value !== selected.answer &&
                      handleSaveEdit({ answer: e.target.value })
                    }
                  />
                  <Input
                    defaultValue={selected.category ?? ""}
                    placeholder="Category"
                    onBlur={(e) => handleSaveEdit({ category: e.target.value })}
                  />
                  <p className="text-xs text-neutral-400">
                    Fields save automatically when you click away.
                  </p>
                </div>
              ) : (
                <p className="whitespace-pre-wrap border-t border-neutral-100 pt-3 text-sm text-neutral-600">
                  {selected.answer}
                </p>
              )}

              <div className="border-t border-neutral-100 pt-3">
                <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                  Version history
                </h3>
                <VersionHistory
                  versions={versions}
                  onCompare={(from, to) => api.faq.compareVersions(selected.id, from, to)}
                  onRestore={async (v) => {
                    setSelected(await api.faq.restoreVersion(selected.id, v));
                    loadSelected(selected.id);
                    loadList();
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Select a FAQ item to view and edit it.</p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function CmsFaqPage() {
  return (
    <RequirePermission permission="cms:manage">
      <CmsFaqContent />
    </RequirePermission>
  );
}
