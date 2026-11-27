"use client";

import * as React from "react";
import { Landmark } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import { COLLEGE_CATEGORIES, type AdminCollege } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { MediaField } from "@/components/media-field";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { useStudentAdminApi, type CollegeInput } from "@/lib/student-admin-api";
import { DeleteGate } from "@/components/delete-gate";

const CATEGORY_LABEL: Record<string, string> = {
  ARCHITECTURE: "Architecture",
  DESIGN: "Design",
  FASHION: "Fashion",
  STUDY_ABROAD: "Study abroad",
};

const EMPTY: CollegeInput = {
  name: "",
  city: "",
  categories: [],
  logoUrl: "",
  applicationFee: null,
  website: "",
  description: "",
  published: true,
};

function CollegeForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: AdminCollege | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const api = useStudentAdminApi();
  const [form, setForm] = React.useState<CollegeInput>(
    initial
      ? {
          name: initial.name,
          city: initial.city,
          categories: initial.categories,
          logoUrl: initial.logoUrl ?? "",
          applicationFee: initial.applicationFee,
          website: initial.website ?? "",
          description: initial.description ?? "",
          published: initial.published,
        }
      : EMPTY,
  );
  const [fee, setFee] = React.useState(initial?.applicationFee?.toString() ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const patch = (p: Partial<CollegeInput>) => setForm((f) => ({ ...f, ...p }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const feeValue = fee.trim() === "" ? null : Number(fee);
    if (feeValue !== null && (!Number.isInteger(feeValue) || feeValue < 0)) {
      setError("Fee must be a whole number of rupees.");
      return;
    }
    const body: CollegeInput = {
      ...form,
      applicationFee: feeValue,
      logoUrl: form.logoUrl || null,
      website: form.website || null,
      description: form.description || null,
    };
    setSaving(true);
    try {
      if (initial) await api.updateCollege(initial.id, body);
      else await api.createCollege(body);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">
          {initial ? `Edit ${initial.name}` : "New college"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-name">Name</Label>
            <Input
              id="c-name"
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-city">City</Label>
            <Input
              id="c-city"
              value={form.city}
              onChange={(e) => patch({ city: e.target.value })}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-fee">Application fee (₹, blank if not published)</Label>
            <Input
              id="c-fee"
              inputMode="numeric"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-web">Website</Label>
            <Input
              id="c-web"
              placeholder="https://…"
              value={form.website ?? ""}
              onChange={(e) => patch({ website: e.target.value })}
            />
          </div>
        </div>
        <fieldset>
          <legend className="text-sm font-medium">Categories</legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            {COLLEGE_CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.categories.includes(c)}
                  onChange={(e) =>
                    patch({
                      categories: e.target.checked
                        ? [...form.categories, c]
                        : form.categories.filter((x) => x !== c),
                    })
                  }
                />
                {CATEGORY_LABEL[c]}
              </label>
            ))}
          </div>
        </fieldset>
        <MediaField
          id="c-logo"
          label="Logo"
          kind="image"
          value={form.logoUrl ?? ""}
          onChange={(v) => patch({ logoUrl: v })}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-desc">About, courses and eligibility (Markdown)</Label>
          <textarea
            id="c-desc"
            value={form.description ?? ""}
            onChange={(e) => patch({ description: e.target.value })}
            className="min-h-32 rounded-md border border-neutral-300 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.published ?? true}
            onChange={(e) => patch({ published: e.target.checked })}
          />
          Visible to students
        </label>
        <FieldError>{error}</FieldError>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save college"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function CollegesContent() {
  const api = useStudentAdminApi();
  const [rows, setRows] = React.useState<AdminCollege[] | null>(null);
  const [error, setError] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminCollege | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<AdminCollege | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    setError(false);
    api
      .colleges()
      .then(setRows)
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => load(), [load]);

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Colleges"
        subtitle="Colleges students can explore, shortlist and enquire about."
        actions={
          editing === null ? (
            <Button onClick={() => setEditing("new")}>Add college</Button>
          ) : undefined
        }
      />
      {editing !== null ? (
        <CollegeForm
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}
      <Card density="compact" className="p-0">
        {error ? (
          <RetryInline message="Couldn't load colleges" onRetry={load} />
        ) : rows === null ? (
          <p className="p-4 text-sm text-neutral-500">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={Landmark} heading="No colleges yet" />
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rows.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-neutral-500">
                    {c.city} ·{" "}
                    {c.categories.map((x) => CATEGORY_LABEL[x]).join(", ") || "No category"} ·{" "}
                    {c.shortlistCount} shortlisted · {c.enquiryCount} enquiries
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!c.published ? <Chip tone="neutral">Hidden</Chip> : null}
                  <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                    Edit
                  </Button>
                  <DeleteGate type={"college"} id={c.id}>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(c)}>
                      Delete
                    </Button>
                  </DeleteGate>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete college?"
        message={
          deleting ? `${deleting.name}, its shortlists and enquiries will be removed.` : null
        }
        confirmLabel="Delete"
        tone="danger"
        submitting={busy}
        error={null}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          await api.deleteCollege(deleting.id).catch(() => undefined);
          setBusy(false);
          setDeleting(null);
          load();
        }}
        onCancel={() => setDeleting(null)}
      />
    </main>
  );
}

export default function AdminCollegesPage() {
  return (
    <RequirePermission permission="colleges:manage">
      <CollegesContent />
    </RequirePermission>
  );
}
