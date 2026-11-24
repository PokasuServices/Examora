"use client";

import * as React from "react";
import { ApiError, useAuth } from "@examora/auth-client";
import type { CohortView, Course, PaginatedData, UserProfile } from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SelectField } from "@/components/ui/select-field";
import { useCommerceAdminApi } from "@/lib/commerce-api";
import { useContentApi } from "@/lib/content-api";

type Target = "all" | "selected" | "cohort";
type PickedStudent = { id: string; label: string };

function studentLabel(u: UserProfile): string {
  const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return name ? `${name} (${u.email})` : u.email;
}

/**
 * Assign or remove course licences in bulk (student module redesign: students
 * don't buy courses, an administrator assigns them): pick courses, then every
 * student or a hand-picked set.
 */
export function BulkLicencePanel({ onChanged }: { onChanged: () => void }) {
  const { request } = useAuth();
  const commerce = useCommerceAdminApi();
  const content = useContentApi();
  const contentRef = React.useRef(content);
  contentRef.current = content;

  const [courses, setCourses] = React.useState<Course[] | null>(null);
  const [courseIds, setCourseIds] = React.useState<Set<string>>(new Set());
  const [target, setTarget] = React.useState<Target>("all");
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<UserProfile[]>([]);
  const [picked, setPicked] = React.useState<PickedStudent[]>([]);
  const [cohorts, setCohorts] = React.useState<CohortView[]>([]);
  const [cohortId, setCohortId] = React.useState("");

  React.useEffect(() => {
    request<CohortView[]>("/admin/cohorts", { method: "GET" })
      .then(setCohorts)
      .catch(() => setCohorts([]));
  }, [request]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = React.useState(false);

  React.useEffect(() => {
    contentRef.current
      .listCourses()
      .then((res) => setCourses(res.items))
      .catch(() => setCourses([]));
  }, []);

  // Debounced student search (selected-students mode only).
  React.useEffect(() => {
    if (target !== "selected" || !query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      const qs = new URLSearchParams({ role: "STUDENT", search: query.trim(), pageSize: "20" });
      request<PaginatedData<UserProfile>>(`/admin/users?${qs.toString()}`, { method: "GET" })
        .then((res) => setResults(res.items))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, target, request]);

  function toggleCourse(id: string) {
    setCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePicked(u: UserProfile) {
    setPicked((prev) =>
      prev.some((p) => p.id === u.id)
        ? prev.filter((p) => p.id !== u.id)
        : [...prev, { id: u.id, label: studentLabel(u) }],
    );
  }

  const ready =
    courseIds.size > 0 &&
    (target === "all" || (target === "selected" ? picked.length > 0 : cohortId !== ""));
  const body = () => ({
    courseIds: [...courseIds],
    ...(target === "all"
      ? { allStudents: true }
      : target === "cohort"
        ? { cohortId }
        : { userIds: picked.map((p) => p.id) }),
  });

  async function run(kind: "grant" | "revoke") {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const r =
        kind === "grant"
          ? await commerce.bulkGrantLicences(body())
          : await commerce.bulkRevokeLicences(body());
      const scope = `${r.students} student${r.students === 1 ? "" : "s"} × ${r.courses} course${r.courses === 1 ? "" : "s"}`;
      setMessage(
        kind === "grant"
          ? `Assigned ${r.changed} new licence${r.changed === 1 ? "" : "s"} (${scope}). Students who already had access are unchanged.`
          : `Removed ${r.changed} licence${r.changed === 1 ? "" : "s"} (${scope}).`,
      );
      setConfirmRevoke(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update licences");
    } finally {
      setBusy(false);
    }
  }

  const allSelected = courses !== null && courses.length > 0 && courseIds.size === courses.length;

  return (
    <section className="flex flex-col gap-5 rounded-md border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div>
        <h2 className="font-heading text-base font-semibold text-neutral-900 dark:text-white/90">
          Assign course licences
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Students don&rsquo;t buy courses; give access here to everyone or to chosen students.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium text-neutral-800 dark:text-neutral-200">
          Courses
          {courses && courses.length > 0 ? (
            <button
              type="button"
              onClick={() =>
                setCourseIds(allSelected ? new Set() : new Set(courses.map((c) => c.id)))
              }
              className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          ) : null}
        </legend>
        {courses === null ? (
          <p className="text-sm text-neutral-500">Loading courses…</p>
        ) : courses.length === 0 ? (
          <p className="text-sm text-neutral-500">No courses found.</p>
        ) : (
          <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-neutral-100 p-2 dark:border-neutral-800 sm:grid-cols-2">
            {courses.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={courseIds.has(c.id)}
                    onChange={() => toggleCourse(c.id)}
                    className="mt-0.5"
                  />
                  <span className="text-neutral-800 dark:text-neutral-200">
                    {c.title}
                    {c.status !== "PUBLISHED" ? (
                      <span className="ml-1 text-xs text-neutral-500">
                        ({c.status.toLowerCase()})
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
          Students
        </legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {(["all", "selected", "cohort"] as Target[]).map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="licence-target"
                checked={target === t}
                onChange={() => setTarget(t)}
              />
              {t === "all" ? "All students" : t === "selected" ? "Selected students" : "A cohort"}
            </label>
          ))}
        </div>

        {target === "cohort" ? (
          <div className="max-w-sm">
            <SelectField
              id="licence-cohort"
              label="Cohort"
              value={cohortId}
              options={[
                {
                  value: "",
                  label: cohorts.length
                    ? "— choose —"
                    : "No cohorts yet (create one under Students → Cohorts)",
                },
                ...cohorts.map((c) => ({ value: c.id, label: `${c.name} (${c.memberCount})` })),
              ]}
              onChange={setCohortId}
            />
          </div>
        ) : null}
        {target === "selected" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="licence-student-search">Find students by name or email</Label>
            <Input
              id="licence-student-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. student@examora.test"
            />
            {results.length > 0 ? (
              <ul className="max-h-48 overflow-y-auto rounded-md border border-neutral-100 p-1 dark:border-neutral-800">
                {results.map((u) => (
                  <li key={u.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={picked.some((p) => p.id === u.id)}
                        onChange={() => togglePicked(u)}
                      />
                      {studentLabel(u)}
                    </label>
                  </li>
                ))}
              </ul>
            ) : query.trim() ? (
              <p className="text-xs text-neutral-500">No matching students.</p>
            ) : null}
            {picked.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Chosen students">
                {picked.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))}
                      className="rounded-full bg-primary-50 px-2.5 py-1 text-xs text-primary-800 hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-200"
                      aria-label={`Remove ${p.label}`}
                    >
                      {p.label} ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <FieldError>{error}</FieldError>
      {message ? (
        <p role="status" className="text-sm text-success-700 dark:text-success-400">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void run("grant")} disabled={!ready || busy}>
          {busy ? "Working…" : "Assign licences"}
        </Button>
        <Button variant="outline" onClick={() => setConfirmRevoke(true)} disabled={!ready || busy}>
          Remove licences
        </Button>
      </div>

      <ConfirmDialog
        open={confirmRevoke}
        title="Remove licences?"
        message={
          <>
            Remove access to {courseIds.size} course{courseIds.size === 1 ? "" : "s"} for{" "}
            {target === "all"
              ? "every student"
              : `${picked.length} selected student${picked.length === 1 ? "" : "s"}`}
            ? Their progress is kept and returns if access is assigned again.
          </>
        }
        confirmLabel="Remove licences"
        tone="danger"
        submitting={busy}
        error={error}
        onConfirm={() => void run("revoke")}
        onCancel={() => setConfirmRevoke(false)}
      />
    </section>
  );
}
