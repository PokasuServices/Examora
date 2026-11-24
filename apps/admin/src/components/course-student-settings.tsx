"use client";

import * as React from "react";
import { ApiError, useAuth } from "@examora/auth-client";
import {
  SUBJECT_COLORS,
  SUBJECT_ICONS,
  type Course,
  type PastPaperStatRow,
  type Subject,
} from "@examora/types";
import { Button, FieldError, Input, Label } from "@examora/ui";
import { SelectField } from "@/components/ui/select-field";
import { useContentApi } from "@/lib/content-api";

const SECTION =
  "rounded-md border border-neutral-200 p-4 dark:border-neutral-800 flex flex-col gap-4";

function SubjectRow({ subject, onSaved }: { subject: Subject; onSaved: () => void }) {
  const api = useContentApi();
  const [kind, setKind] = React.useState(subject.kind);
  const [icon, setIcon] = React.useState(subject.icon ?? "");
  const [color, setColor] = React.useState(subject.color ?? "");
  const [state, setState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty =
    kind !== subject.kind || icon !== (subject.icon ?? "") || color !== (subject.color ?? "");

  async function save() {
    setState("saving");
    try {
      await api.updateNode("subjects", subject.id, {
        kind,
        icon: icon || null,
        color: color || null,
      });
      setState("saved");
      onSaved();
    } catch {
      setState("error");
    }
  }

  return (
    <tr>
      <th
        scope="row"
        className="py-2 pr-3 text-left text-sm font-medium text-neutral-800 dark:text-white/90"
      >
        {subject.title}
      </th>
      <td className="py-2 pr-3">
        <SelectField
          id={`kind-${subject.id}`}
          label="Tag"
          value={kind}
          options={[
            { value: "SUBJECT", label: "Subject" },
            { value: "ESSENTIALS", label: "Essentials" },
          ]}
          onChange={(v) => setKind(v as Subject["kind"])}
        />
      </td>
      <td className="py-2 pr-3">
        <SelectField
          id={`icon-${subject.id}`}
          label="Icon"
          value={icon}
          options={[
            { value: "", label: "Default" },
            ...SUBJECT_ICONS.map((i) => ({ value: i, label: i })),
          ]}
          onChange={setIcon}
        />
      </td>
      <td className="py-2 pr-3">
        <SelectField
          id={`color-${subject.id}`}
          label="Colour"
          value={color}
          options={[
            { value: "", label: "Primary" },
            ...SUBJECT_COLORS.map((c) => ({ value: c, label: c })),
          ]}
          onChange={setColor}
        />
      </td>
      <td className="py-2 align-bottom">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!dirty || state === "saving"}
          onClick={() => void save()}
        >
          {state === "saving" ? "Saving…" : "Save"}
        </Button>
        {state === "saved" && !dirty ? (
          <span className="ml-2 text-xs text-success-600">Saved</span>
        ) : null}
        {state === "error" ? <span className="ml-2 text-xs text-danger-600">Failed</span> : null}
      </td>
    </tr>
  );
}

/** cell key "<exam>|<subjectId>|<year>" → typed text */
type Grid = Record<string, string>;
const cellKey = (exam: string, subjectId: string, year: number) => `${exam}|${subjectId}|${year}`;

function HeatmapEditor({ courseId, subjects }: { courseId: string; subjects: Subject[] }) {
  const { request } = useAuth();
  const [loaded, setLoaded] = React.useState(false);
  const [exams, setExams] = React.useState<string[]>([]);
  const [exam, setExam] = React.useState("");
  const [years, setYears] = React.useState<number[]>([]);
  const [grid, setGrid] = React.useState<Grid>({});
  const [newExam, setNewExam] = React.useState("");
  const [newYear, setNewYear] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const path = `/admin/content/courses/${courseId}/past-paper-stats`;

  React.useEffect(() => {
    request<PastPaperStatRow[]>(path, { method: "GET" })
      .then((rows) => {
        const labels = [...new Set(rows.map((r) => r.examLabel))];
        const g: Grid = {};
        for (const r of rows)
          g[cellKey(r.examLabel, r.subjectId, r.year)] = String(r.questionCount);
        setExams(labels);
        setExam(labels[0] ?? "");
        setYears([...new Set(rows.map((r) => r.year))].sort((a, b) => a - b));
        setGrid(g);
      })
      .catch(() => setError("Couldn't load the heatmap"))
      .finally(() => setLoaded(true));
  }, [path, request]);

  function addExam() {
    const label = newExam.trim();
    if (!label || exams.includes(label)) return;
    setExams((prev) => [...prev, label]);
    setExam(label);
    setNewExam("");
  }

  function addYear() {
    const y = Number(newYear);
    if (!Number.isInteger(y) || y < 1990 || y > 2100 || years.includes(y)) return;
    setYears((prev) => [...prev, y].sort((a, b) => a - b));
    setNewYear("");
  }

  async function save() {
    setError(null);
    setSaved(false);
    const rows: PastPaperStatRow[] = [];
    for (const [key, raw] of Object.entries(grid)) {
      if (raw.trim() === "") continue;
      const [examLabel, subjectId, yearText] = key.split("|") as [string, string, string];
      const year = Number(yearText);
      const count = Number(raw);
      if (
        !exams.includes(examLabel) ||
        !years.includes(year) ||
        !subjects.some((s) => s.id === subjectId)
      )
        continue;
      if (!Number.isInteger(count) || count < 0) {
        setError("Counts must be whole numbers of 0 or more.");
        return;
      }
      rows.push({ examLabel, subjectId, year, questionCount: count });
    }
    setSaving(true);
    try {
      await request<PastPaperStatRow[]>(path, { method: "PUT", body: { rows } });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the heatmap");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p className="text-sm text-neutral-500">Loading heatmap…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {exams.length > 0 ? (
          <div className="w-48">
            <SelectField
              id="heatmap-exam"
              label="Exam"
              value={exam}
              options={exams.map((e) => ({ value: e, label: e }))}
              onChange={setExam}
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="heatmap-new-exam">Add exam</Label>
          <Input
            id="heatmap-new-exam"
            value={newExam}
            onChange={(e) => setNewExam(e.target.value)}
            placeholder="e.g. UCEED"
            className="w-40"
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addExam}>
          Add exam
        </Button>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="heatmap-new-year">Add year</Label>
          <Input
            id="heatmap-new-year"
            inputMode="numeric"
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            placeholder="2025"
            className="w-24"
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addYear}>
          Add year
        </Button>
      </div>

      {exam && years.length > 0 && subjects.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="text-sm">
            <caption className="sr-only">Questions per subject per year for {exam}</caption>
            <thead>
              <tr>
                <th scope="col" className="pr-3 text-left font-medium">
                  Subject
                </th>
                {years.map((y) => (
                  <th key={y} scope="col" className="px-1 text-center font-medium">
                    {y}{" "}
                    <button
                      type="button"
                      aria-label={`Remove year ${y}`}
                      onClick={() => setYears((prev) => prev.filter((x) => x !== y))}
                      className="text-xs text-neutral-400 hover:text-danger-600"
                    >
                      ×
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <th
                    scope="row"
                    className="py-1 pr-3 text-left font-normal text-neutral-700 dark:text-neutral-300"
                  >
                    {s.title}
                  </th>
                  {years.map((y) => {
                    const key = cellKey(exam, s.id, y);
                    return (
                      <td key={y} className="px-1 py-1">
                        <Input
                          aria-label={`${s.title} ${y}`}
                          inputMode="numeric"
                          value={grid[key] ?? ""}
                          onChange={(e) => setGrid((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="h-8 w-16 text-center"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Add an exam and at least one year to start filling in the heatmap.
        </p>
      )}

      <FieldError>{error}</FieldError>
      {saved ? (
        <p role="status" className="text-sm text-success-600 dark:text-success-400">
          Heatmap saved.
        </p>
      ) : null}
      <div>
        <Button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save heatmap"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Settings for the student Learn page: next exam date, how each subject card
 * looks (tag, icon, colour), and the syllabus heatmap's past-paper numbers.
 */
export function CourseStudentSettings({
  course,
  onCourseSaved,
}: {
  course: Course;
  onCourseSaved: (course: Course) => void;
}) {
  const api = useContentApi();
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const [examDate, setExamDate] = React.useState(course.nextExamDate?.slice(0, 10) ?? "");
  const [dateState, setDateState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [subjects, setSubjects] = React.useState<Subject[] | null>(null);

  const loadSubjects = React.useCallback(() => {
    apiRef.current
      .listNodes<Subject>("subjects", "courseId", course.id)
      .then((res) => setSubjects(res.items))
      .catch(() => setSubjects([]));
  }, [course.id]);

  React.useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  async function saveDate() {
    setDateState("saving");
    try {
      onCourseSaved(await api.updateCourse(course.id, { nextExamDate: examDate || null }));
      setDateState("saved");
    } catch {
      setDateState("error");
    }
  }

  return (
    <section className="mt-8 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Student Learn page</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          What students see on this course&rsquo;s Learn page.
        </p>
      </div>

      <div className={SECTION}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="next-exam-date">Next exam date</Label>
            <Input
              id="next-exam-date"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-44"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={dateState === "saving"}
            onClick={() => void saveDate()}
          >
            {dateState === "saving" ? "Saving…" : "Save date"}
          </Button>
          {dateState === "saved" ? <span className="text-xs text-success-600">Saved</span> : null}
          {dateState === "error" ? (
            <span className="text-xs text-danger-600">Couldn&rsquo;t save</span>
          ) : null}
        </div>
      </div>

      <div className={SECTION}>
        <h3 className="text-sm font-semibold">Subject cards</h3>
        {subjects === null ? (
          <p className="text-sm text-neutral-500">Loading subjects…</p>
        ) : subjects.length === 0 ? (
          <p className="text-sm text-neutral-500">Add subjects in the curriculum below first.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[640px]">
              <tbody>
                {subjects.map((s) => (
                  <SubjectRow key={`${s.id}-${s.updatedAt}`} subject={s} onSaved={loadSubjects} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={SECTION}>
        <h3 className="text-sm font-semibold">
          Syllabus heatmap (past-paper questions per subject)
        </h3>
        {subjects && subjects.length > 0 ? (
          <HeatmapEditor courseId={course.id} subjects={subjects} />
        ) : (
          <p className="text-sm text-neutral-500">Add subjects first.</p>
        )}
      </div>
    </section>
  );
}
