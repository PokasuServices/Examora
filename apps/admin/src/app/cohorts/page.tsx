"use client";

import * as React from "react";
import { Users } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { CohortView } from "@examora/types";
import { Button, FieldError, Input, Label, cn } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { useStudentAdminApi } from "@/lib/student-admin-api";

function Members({ cohort, onChanged }: { cohort: CohortView; onChanged: () => void }) {
  const api = useStudentAdminApi();
  const [members, setMembers] = React.useState<
    { userId: string; email: string; name: string }[] | null
  >(null);
  const [emails, setEmails] = React.useState("");
  const [result, setResult] = React.useState<string | null>(null);
  const load = React.useCallback(() => {
    api
      .cohortMembers(cohort.id)
      .then(setMembers)
      .catch(() => setMembers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohort.id]);
  React.useEffect(() => load(), [load]);

  return (
    <Card>
      <h2 className="text-base font-semibold">{cohort.name}</h2>
      <p className="text-xs text-neutral-500">
        Assign courses to everyone in this cohort from Commerce → Enrollments (choose
        &ldquo;Cohort&rdquo;).
      </p>
      <div className="mt-4 flex flex-col gap-1.5">
        <Label htmlFor="cohort-emails">
          Add students by email (one per line or comma-separated)
        </Label>
        <textarea
          id="cohort-emails"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          className="min-h-20 rounded-md border border-neutral-300 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            disabled={!emails.trim()}
            onClick={async () => {
              const r = await api.addCohortMembers(
                cohort.id,
                emails.split(/[\s,;]+/).filter(Boolean),
              );
              setResult(
                `Added ${r.added}.${r.notFound.length ? ` Not found: ${r.notFound.join(", ")}` : ""}`,
              );
              setEmails("");
              load();
              onChanged();
            }}
          >
            Add
          </Button>
          {result ? (
            <span role="status" className="text-xs text-neutral-600">
              {result}
            </span>
          ) : null}
        </div>
      </div>
      {members === null ? (
        <p className="mt-4 text-sm text-neutral-500">Loading members…</p>
      ) : members.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No members yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {m.name} <span className="text-xs text-neutral-500">{m.email}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await api.removeCohortMember(cohort.id, m.userId);
                  load();
                  onChanged();
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CohortsContent() {
  const api = useStudentAdminApi();
  const [rows, setRows] = React.useState<CohortView[] | null>(null);
  const [error, setError] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [batch, setBatch] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setError(false);
    api
      .cohorts()
      .then(setRows)
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => load(), [load]);
  const current = rows?.find((r) => r.id === selected) ?? null;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Cohorts"
        subtitle="Batches or classrooms of students. Courses can be assigned to a whole cohort."
      />
      <Card>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setFormError(null);
            try {
              await api.createCohort({ name: name.trim(), batch: batch.trim() || undefined });
              setName("");
              setBatch("");
              load();
            } catch (err) {
              setFormError(err instanceof ApiError ? err.message : "Couldn't create");
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cohort-name">New cohort</Label>
            <Input
              id="cohort-name"
              placeholder="2027 NID UCEED – Weekend"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-72"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cohort-batch">Batch</Label>
            <Input
              id="cohort-batch"
              placeholder="Online"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className="w-40"
            />
          </div>
          <Button type="submit" disabled={name.trim().length < 2}>
            Create
          </Button>
        </form>
        <FieldError>{formError}</FieldError>
      </Card>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Card density="compact" className="p-0">
          {error ? (
            <RetryInline message="Couldn't load cohorts" onRetry={load} />
          ) : rows === null ? (
            <p className="p-4 text-sm text-neutral-500">Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState icon={Users} heading="No cohorts yet" />
          ) : (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {rows.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c.id)}
                    className={cn(
                      "flex w-full justify-between px-4 py-3 text-left text-sm hover:bg-neutral-50 dark:hover:bg-white/[0.03]",
                      selected === c.id && "bg-primary-50 dark:bg-primary-500/15",
                    )}
                  >
                    <span>
                      <span className="block font-medium">{c.name}</span>
                      {c.batch ? (
                        <span className="block text-xs text-neutral-500">{c.batch}</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-neutral-500">{c.memberCount}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {current ? (
          <Members key={current.id} cohort={current} onChanged={load} />
        ) : (
          <Card>
            <p className="text-sm text-neutral-500">Choose a cohort to manage its members.</p>
          </Card>
        )}
      </div>
    </main>
  );
}

export default function CohortsPage() {
  return (
    <RequirePermission permission="users:manage">
      <CohortsContent />
    </RequirePermission>
  );
}
