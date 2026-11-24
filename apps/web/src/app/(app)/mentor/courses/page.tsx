"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import type {
  MentorCourseOption,
  MentorCourseProgress,
  MentorCourseStudentRow,
} from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField, type SelectFieldOption } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { CatalogSearchInput } from "@/components/courses/catalog-filters";
import { useMentorApi } from "@/lib/mentor-api";
import { timeAgo } from "@/lib/format";

const STORAGE_KEY = "examora.mentor.course";

type Sort = "name" | "completion" | "tests" | "review" | "last-active";
const SORT_OPTIONS: SelectFieldOption[] = [
  { value: "name", label: "Name A–Z" },
  { value: "completion", label: "Lessons completed" },
  { value: "tests", label: "Test average" },
  { value: "review", label: "Waiting for review" },
  { value: "last-active", label: "Last activity" },
];

/** Assignment states, in a fixed order with fixed colours (legend + numbers always shown). */
const STATES = [
  { key: "approved", label: "Approved", bar: "bg-success-500" },
  { key: "awaitingReview", label: "Waiting for review", bar: "bg-warning-500" },
  { key: "revisionRequested", label: "Revision asked", bar: "bg-danger-500" },
  { key: "draft", label: "Draft", bar: "bg-primary-300" },
  { key: "notStarted", label: "Not started", bar: "bg-neutral-200 dark:bg-white/10" },
] as const;

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function store(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Remembering the course is only a convenience.
  }
}

function Bar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
        <div className="h-full rounded-full bg-primary-600" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-9 shrink-0 text-xs tabular-nums text-neutral-500">{percent}%</span>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card density="compact">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-800 dark:text-white/90">
        {value}
      </p>
      {hint ? <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p> : null}
    </Card>
  );
}

function sortRows(rows: MentorCourseStudentRow[], sort: Sort) {
  const r = [...rows];
  switch (sort) {
    case "completion":
      return r.sort((a, b) => b.completionPercent - a.completionPercent);
    case "tests":
      return r.sort((a, b) => (b.testAveragePercent ?? -1) - (a.testAveragePercent ?? -1));
    case "review":
      return r.sort((a, b) => b.assignments.awaitingReview - a.assignments.awaitingReview);
    case "last-active":
      return r.sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? ""));
    default:
      return r.sort((a, b) => a.name.localeCompare(b.name));
  }
}

function AssignmentChips({
  a,
  total,
}: {
  a: MentorCourseStudentRow["assignments"];
  total: number;
}) {
  if (total === 0) return <span className="text-xs text-neutral-400">None</span>;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs tabular-nums text-neutral-600 dark:text-neutral-300">
        {a.approved}/{total} approved
      </span>
      {a.awaitingReview > 0 ? <Chip tone="warning">{a.awaitingReview} to review</Chip> : null}
      {a.revisionRequested > 0 ? <Chip tone="danger">{a.revisionRequested} revising</Chip> : null}
    </div>
  );
}

function StudentsTable({ data }: { data: MentorCourseProgress }) {
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<Sort>("name");
  const { lessonCount, testCount, assignmentCount } = data.course;
  const q = search.trim().toLowerCase();
  const rows = sortRows(
    data.students.filter(
      (s) => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    ),
    sort,
  );

  return (
    <section className="flex flex-col gap-3" aria-labelledby="students-h">
      <h2 id="students-h" className="text-lg font-medium text-neutral-800 dark:text-white/90">
        Students
      </h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <CatalogSearchInput id="course-student-search" value={search} onChange={setSearch} />
        <SelectField
          id="course-sort"
          label="Sort by"
          value={sort}
          options={SORT_OPTIONS}
          onChange={(v) => setSort(v as Sort)}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState heading="No students match your search" />
      ) : (
        <div className="overflow-x-auto rounded-card border border-neutral-200 bg-white shadow-soft dark:border-neutral-800 dark:bg-neutral-900">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs font-medium text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
                <th scope="col" className="px-5 py-3">
                  Student
                </th>
                <th scope="col" className="px-3 py-3">
                  Lessons ({lessonCount})
                </th>
                <th scope="col" className="px-3 py-3">
                  Tests ({testCount})
                </th>
                <th scope="col" className="px-3 py-3">
                  Assignments
                </th>
                <th scope="col" className="px-3 py-3">
                  Last activity
                </th>
                <th scope="col" className="px-5 py-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {rows.map((s) => (
                <tr key={s.studentId} className="hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <p className="font-medium text-neutral-800 dark:text-white/90">{s.name}</p>
                    <p className="text-xs text-neutral-500">{s.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    <Bar percent={s.completionPercent} />
                    <p className="text-xs text-neutral-500">
                      {s.lessonsCompleted} of {lessonCount}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-xs text-neutral-600 dark:text-neutral-300">
                    <span className="tabular-nums">
                      {s.testsTaken}/{testCount} taken
                    </span>
                    <br />
                    <span className="text-neutral-500">
                      {s.testAveragePercent === null
                        ? "No scores yet"
                        : `${s.testAveragePercent}% average`}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <AssignmentChips a={s.assignments} total={assignmentCount} />
                  </td>
                  <td className="px-3 py-3 text-xs text-neutral-500">
                    {s.lastActiveAt ? timeAgo(s.lastActiveAt) : "Not started"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/mentor/students/${s.studentId}`}
                      aria-label={`Open ${s.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-white/5"
                    >
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AssignmentsSection({ data }: { data: MentorCourseProgress }) {
  if (data.assignments.length === 0) return null;
  const studentCount = data.students.length;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="assign-h">
      <h2 id="assign-h" className="text-lg font-medium text-neutral-800 dark:text-white/90">
        Assignments
      </h2>
      <ul
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400"
        aria-label="Legend"
      >
        {STATES.map((st) => (
          <li key={st.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${st.bar}`} />
            {st.label}
          </li>
        ))}
      </ul>
      <Card density="compact" className="!p-0">
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {data.assignments.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 px-5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-neutral-800 dark:text-white/90">{a.title}</p>
                {a.deadline ? (
                  <p className="text-xs text-neutral-500">
                    Due{" "}
                    {new Date(a.deadline).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                ) : null}
              </div>
              <div
                className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full"
                role="img"
                aria-label={STATES.map((st) => `${a[st.key]} ${st.label.toLowerCase()}`).join(", ")}
              >
                {STATES.map((st) =>
                  a[st.key] > 0 ? (
                    <span
                      key={st.key}
                      className={st.bar}
                      style={{ width: `${(a[st.key] / Math.max(1, studentCount)) * 100}%` }}
                      title={`${st.label}: ${a[st.key]}`}
                    />
                  ) : null,
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {STATES.filter((st) => a[st.key] > 0)
                  .map((st) => `${a[st.key]} ${st.label.toLowerCase()}`)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function CourseProgressContent() {
  const api = useMentorApi();
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const [courses, setCourses] = React.useState<MentorCourseOption[] | null>(null);
  const [coursesError, setCoursesError] = React.useState(false);
  const [courseId, setCourseId] = React.useState("");
  const [data, setData] = React.useState<MentorCourseProgress | null>(null);
  const [loadError, setLoadError] = React.useState(false);

  const loadCourses = React.useCallback(() => {
    setCoursesError(false);
    apiRef.current
      .listMyCourses()
      .then((list) => {
        setCourses(list);
        const stored = readStored();
        setCourseId(list.find((c) => c.id === stored)?.id ?? list[0]?.id ?? "");
      })
      .catch(() => setCoursesError(true));
  }, []);
  React.useEffect(() => loadCourses(), [loadCourses]);

  const loadProgress = React.useCallback(() => {
    if (!courseId) return;
    setData(null);
    setLoadError(false);
    apiRef.current
      .getCourseProgress(courseId)
      .then(setData)
      .catch(() => setLoadError(true));
  }, [courseId]);
  React.useEffect(() => loadProgress(), [loadProgress]);

  if (coursesError) {
    return <RetryInline message="Couldn't load your courses" onRetry={loadCourses} />;
  }
  if (!courses) return <Skeleton className="h-40 w-full" />;

  const totals = data
    ? {
        avgCompletion: data.students.length
          ? Math.round(
              data.students.reduce((s, r) => s + r.completionPercent, 0) / data.students.length,
            )
          : 0,
        toReview: data.students.reduce((s, r) => s + r.assignments.awaitingReview, 0),
        notStarted: data.students.filter((r) => r.lastActiveAt === null).length,
      }
    : null;

  return (
    <main className="flex flex-col gap-6">
      <div>
        <PageTitle>Course progress</PageTitle>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Pick a course to see how your students are doing in it.
        </p>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          heading="No courses yet"
          body="Courses appear here once your assigned students hold a licence for them."
        />
      ) : (
        <>
          <div className="sm:max-w-md">
            <SelectField
              id="mentor-course"
              label="Course"
              value={courseId}
              options={courses.map((c) => ({
                value: c.id,
                label: `${c.title} (${c.studentCount} ${c.studentCount === 1 ? "student" : "students"})`,
              }))}
              onChange={(v) => {
                setCourseId(v);
                store(v);
              }}
            />
          </div>

          {loadError ? (
            <RetryInline message="Couldn't load this course" onRetry={loadProgress} />
          ) : !data || !totals ? (
            <div className="grid gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Tile label="Your students" value={data.students.length} />
                <Tile
                  label="Average lessons done"
                  value={`${totals.avgCompletion}%`}
                  hint={`of ${data.course.lessonCount} lessons`}
                />
                <Tile
                  label="Waiting for review"
                  value={totals.toReview}
                  hint="assignment submissions"
                />
                <Tile
                  label="Not started"
                  value={totals.notStarted}
                  hint="no activity in this course"
                />
              </div>
              <StudentsTable data={data} />
              <AssignmentsSection data={data} />
            </>
          )}
        </>
      )}
    </main>
  );
}

export default function MentorCourseProgressPage() {
  return (
    <RequirePermission permission="mentor:workflow">
      <CourseProgressContent />
    </RequirePermission>
  );
}
