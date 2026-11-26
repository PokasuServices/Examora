"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { LearnSubjectCard } from "@examora/types";
import { Input } from "@examora/ui";
import { ProgressBar } from "@/components/progress-bar";
import { RequireAuth } from "@/components/require-auth";
import { CoverageChart } from "@/components/student/coverage-chart";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { LearnDashboardPanel } from "@/components/student/learn-dashboard";
import { KindChip, SubjectIcon } from "@/components/student/subject-visual";
import { SyllabusHeatmap } from "@/components/student/syllabus-heatmap";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { useLearnApi } from "@/lib/learn-api";

const COURSE_KEY = "examora:learn-course";

function readStoredCourse(): string | null {
  try {
    return window.localStorage.getItem(COURSE_KEY);
  } catch {
    return null;
  }
}

function storeCourse(id: string): void {
  try {
    window.localStorage.setItem(COURSE_KEY, id);
  } catch {
    // Remembering the choice is a convenience only.
  }
}

function SubjectCard({
  subject,
  matches,
}: {
  subject: LearnSubjectCard;
  matches: LearnSubjectCard["topics"];
}) {
  return (
    <Card interactive className="relative flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <SubjectIcon icon={subject.icon} color={subject.color} />
        <KindChip kind={subject.kind} />
      </div>
      <div>
        <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">
          <Link
            href={`/learn/subjects/${subject.id}`}
            className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary-500"
          >
            {subject.title}
          </Link>
        </h2>
        {subject.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">
            {subject.description}
          </p>
        ) : null}
      </div>
      {matches.length > 0 ? (
        <ul className="relative z-10 flex flex-wrap gap-1.5" aria-label="Matching topics">
          {matches.map((t) => (
            <li key={t.id}>
              <Link
                href={`/learn/topics/${t.id}`}
                className="inline-block rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-300"
              >
                {t.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-auto flex flex-col gap-1.5">
        <ProgressBar percent={subject.percent} />
        <p className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <span>
            {subject.topicsDone} of {subject.topicsTotal} topics complete
          </span>
          <span className="tabular-nums">{subject.percent}%</span>
        </p>
      </div>
    </Card>
  );
}

function LearnContent() {
  const api = useLearnApi();
  const courses = useLoad(() => api.listCourses(), "courses");
  const [courseId, setCourseId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  // Pick the remembered course if it's still licensed, else the first one.
  React.useEffect(() => {
    if (!courses.data || courseId) return;
    const stored = readStoredCourse();
    const pick = courses.data.find((c) => c.id === stored) ?? courses.data[0];
    if (pick) setCourseId(pick.id);
  }, [courses.data, courseId]);

  const overview = useLoad(() => api.getCourse(courseId!), courseId);

  const header = (
    <PageHeader
      title="Learn"
      subtitle="Work through each subject topic by topic: read the lessons, then test yourself."
    />
  );

  if (courses.loading && !courses.data) return <LoadingPanel />;
  if (courses.errorStatus !== null) {
    return <ErrorPanel status={courses.errorStatus} onRetry={courses.reload} />;
  }
  if (courses.data && courses.data.length === 0) {
    return (
      <main className="flex flex-col gap-6">
        {header}
        <ErrorPanel status={403} onRetry={courses.reload} />
      </main>
    );
  }

  const q = query.trim().toLowerCase();
  const subjects = overview.data?.subjects ?? [];
  const visible = subjects
    .map((s) => ({
      subject: s,
      matches: q ? s.topics.filter((t) => t.title.toLowerCase().includes(q)) : [],
    }))
    .filter(
      ({ subject, matches }) => !q || subject.title.toLowerCase().includes(q) || matches.length > 0,
    );

  return (
    <main className="flex flex-col gap-6">
      {header}

      <Card density="compact" className="flex flex-wrap items-end gap-4">
        {courses.data && courseId ? (
          <div className="w-full sm:w-72">
            <SelectField
              id="learn-course"
              label="Course"
              value={courseId}
              options={courses.data.map((c) => ({ value: c.id, label: c.title }))}
              onChange={(id) => {
                setCourseId(id);
                storeCourse(id);
                setQuery("");
              }}
            />
          </div>
        ) : null}
        <div className="relative w-full sm:ml-auto sm:w-72">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subjects and topics"
            aria-label="Search subjects and topics"
            className="pl-9"
          />
        </div>
      </Card>

      {overview.errorStatus !== null ? (
        <ErrorPanel status={overview.errorStatus} onRetry={overview.reload} />
      ) : !overview.data || overview.loading ? (
        <LoadingPanel />
      ) : (
        <>
          {!q ? (
            <LearnDashboardPanel
              key={overview.data.course.id}
              dashboard={overview.data.dashboard}
              courseTitle={overview.data.course.title}
            />
          ) : null}
          <h2 className="-mb-2 text-base font-semibold text-neutral-800 dark:text-white/90">
            {q ? "Search results" : "Subjects"}
          </h2>
          {visible.length === 0 ? (
            <Card>
              <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
                Nothing matches &ldquo;{query}&rdquo;.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map(({ subject, matches }) => (
                <SubjectCard key={subject.id} subject={subject} matches={matches} />
              ))}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <CoverageChart subjects={overview.data.subjects} />
            <SyllabusHeatmap
              key={overview.data.course.id}
              heatmaps={overview.data.heatmaps}
              nextExamDate={overview.data.course.nextExamDate}
            />
          </div>
        </>
      )}
    </main>
  );
}

export default function LearnPage() {
  return (
    <RequireAuth>
      <LearnContent />
    </RequireAuth>
  );
}
