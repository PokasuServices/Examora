"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Lock,
  ListChecks,
  TrendingUp,
} from "lucide-react";
import type { PracticeTestItem, WeakTopicAction } from "@examora/types";
import { cn } from "@examora/ui";
import { ProgressBar } from "@/components/progress-bar";
import { RequireAuth } from "@/components/require-auth";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { TestPerformanceChart } from "@/components/student/test-performance-chart";
import { sectionTime, TestSections } from "@/components/student/test-sections";
import { useLicensedCourse } from "@/components/student/use-licensed-course";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { useStudentApi } from "@/lib/student-api";

/** Sections, instructions and marking scheme, loaded when a row is expanded. */
function TestDetails({ id }: { id: string }) {
  const api = useStudentApi();
  const detail = useLoad(() => api.practiceTest(id), id);
  if (detail.errorStatus !== null)
    return <p className="text-sm text-danger-600">Couldn&rsquo;t load the details.</p>;
  if (!detail.data) return <p className="text-sm text-neutral-500">Loading details…</p>;
  return <TestSections sections={detail.data.sections} />;
}

function TestRow({ test }: { test: PracticeTestItem }) {
  const [open, setOpen] = React.useState(false);
  const locked = test.lockedBy !== null;
  const detailsId = React.useId();
  const pct =
    test.lastScore && test.lastScore.total > 0
      ? Math.max(0, Math.round((test.lastScore.obtained / test.lastScore.total) * 100))
      : null;
  const paperLabel = [test.exam, test.paperYear].filter(Boolean).join(" · ");
  return (
    <li className={cn(locked && "bg-neutral-50/60 dark:bg-white/[0.01]")}>
      <div className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_14rem_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {paperLabel ? <Chip tone="primary">{paperLabel}</Chip> : null}
            <Link
              href={`/practice/tests/${test.id}`}
              className="rounded text-sm font-medium text-neutral-800 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-white/90 dark:hover:text-primary-400"
            >
              {test.title}
            </Link>
            {test.inProgressAttemptId ? <Chip tone="warning">In progress</Chip> : null}
            {pct !== null ? <Chip tone="success">Attempted</Chip> : null}
          </div>
          {test.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
              {test.description}
            </p>
          ) : null}
          {test.note ? (
            <p className="mt-1 text-xs italic text-neutral-500 dark:text-neutral-400">
              {test.note}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <Chip tone="neutral">{test.questionCount} questions</Chip>
            {test.timeLimitMinutes ? (
              <Chip tone="neutral">
                <Clock size={12} aria-hidden="true" className="mr-1 inline" />
                {sectionTime(test.timeLimitMinutes)}
              </Chip>
            ) : (
              <Chip tone="neutral">Untimed</Chip>
            )}
            {test.sectionCount > 1 ? (
              <Chip tone="neutral">{test.sectionCount} sections</Chip>
            ) : null}
            {test.xpReward > 0 ? <Chip tone="warning">+{test.xpReward} XP</Chip> : null}
            {test.perfectBonusXp > 0 ? (
              <Chip tone="warning">+{test.perfectBonusXp} XP for 100%</Chip>
            ) : null}
          </div>
          {locked ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
              <Lock size={12} aria-hidden="true" /> Finish &ldquo;{test.lockedBy!.title}&rdquo; to
              unlock
            </p>
          ) : null}
        </div>
        <div>
          {pct !== null ? (
            <>
              <ProgressBar percent={pct} />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Last score {test.lastScore!.obtained} / {test.lastScore!.total}
              </p>
            </>
          ) : (
            <p className="text-xs text-neutral-400">Not attempted</p>
          )}
        </div>
        <div className="flex items-center gap-1 sm:justify-end">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-300 dark:hover:bg-white/5"
          >
            Details
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={cn("transition-transform", open && "rotate-180")}
            />
          </button>
          <Link
            href={`/practice/tests/${test.id}`}
            aria-label={`Open ${test.title}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-white/5"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
      {open ? (
        <div
          id={detailsId}
          className="border-t border-neutral-100 px-4 pb-4 pt-3 dark:border-neutral-800"
        >
          <TestDetails id={test.id} />
        </div>
      ) : null}
    </li>
  );
}

/** Exam / year filters for tabs that hold past papers. */
function PaperFilters({
  tests,
  exam,
  year,
  onExam,
  onYear,
}: {
  tests: PracticeTestItem[];
  exam: string;
  year: string;
  onExam: (v: string) => void;
  onYear: (v: string) => void;
}) {
  const exams = [...new Set(tests.map((t) => t.exam).filter((e): e is string => !!e))].sort();
  const years = [...new Set(tests.map((t) => t.paperYear).filter((y): y is number => !!y))].sort(
    (a, b) => b - a,
  );
  if (exams.length === 0 && years.length === 0) return null;
  return (
    <div className="flex flex-wrap items-end gap-3 px-4 pt-3">
      {exams.length > 1 ? (
        <div role="group" aria-label="Filter by exam" className="flex flex-wrap gap-1.5">
          {["", ...exams].map((e) => (
            <button
              key={e || "all"}
              type="button"
              aria-pressed={exam === e}
              onClick={() => onExam(e)}
              className={cn(
                "h-8 rounded-full border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                exam === e
                  ? "border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-500/40 dark:bg-primary-500/15 dark:text-primary-300"
                  : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-white/[0.03]",
              )}
            >
              {e || "All exams"}
            </button>
          ))}
        </div>
      ) : null}
      {years.length > 1 ? (
        <div className="w-36">
          <SelectField
            id="paper-year-filter"
            label="Year"
            value={year}
            options={[
              { value: "", label: "All years" },
              ...years.map((y) => ({ value: String(y), label: String(y) })),
            ]}
            onChange={onYear}
          />
        </div>
      ) : null}
    </div>
  );
}

function WeakTopicsCard({
  topics,
  onStudied,
}: {
  topics: WeakTopicAction[];
  onStudied: (id: string) => void;
}) {
  const api = useStudentApi();
  const [busy, setBusy] = React.useState<string | null>(null);
  if (topics.length === 0) return null;
  return (
    <Card>
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} aria-hidden="true" className="text-warning-500" />
        <h2 className="text-base font-medium text-neutral-800 dark:text-white/90">
          Needs attention
        </h2>
      </div>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Topics where answers you were sure of turned out wrong. Revise them, then mark them studied.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((t) => (
          <li
            key={t.topicId}
            className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
          >
            <p className="text-sm font-medium text-neutral-800 dark:text-white/90">
              {t.topicTitle}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.subjectTitle}</p>
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
              {t.wrongFromKnowledge} of {t.answered} answered wrong despite knowing
            </p>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <Link
                href={`/learn/topics/${t.topicId}`}
                className="font-medium text-primary-600 hover:underline dark:text-primary-400"
              >
                Revise
              </Link>
              <button
                type="button"
                disabled={busy === t.topicId}
                onClick={async () => {
                  setBusy(t.topicId);
                  try {
                    await api.markStudied(t.topicId, true);
                    onStudied(t.topicId);
                  } finally {
                    setBusy(null);
                  }
                }}
                className="text-neutral-600 hover:underline disabled:opacity-50 dark:text-neutral-400"
              >
                Mark as studied
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PracticeContent() {
  const api = useStudentApi();
  const { courses, courseId, setCourseId } = useLicensedCourse();
  const overview = useLoad(() => api.practice(courseId!), courseId);
  const [tab, setTab] = React.useState<string | null>(null);
  const [studied, setStudied] = React.useState<Set<string>>(new Set());
  const [examFilter, setExamFilter] = React.useState("");
  const [yearFilter, setYearFilter] = React.useState("");

  React.useEffect(() => {
    setTab(null);
    setStudied(new Set());
  }, [courseId]);
  React.useEffect(() => {
    setExamFilter("");
    setYearFilter("");
  }, [tab, courseId]);

  if (courses.loading && !courses.data) return <LoadingPanel />;
  if (courses.errorStatus !== null)
    return <ErrorPanel status={courses.errorStatus} onRetry={courses.reload} />;

  const data = overview.data;
  const categories = data?.categories ?? [];
  const active = categories.find((c) => c.id === tab) ?? categories[0];

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Practice"
        subtitle="Timed tests in exam format, with a detailed report after each one."
        actions={
          <Link
            href="/me?tab=performance"
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-white/5"
          >
            <TrendingUp size={16} aria-hidden="true" /> See my test performance
          </Link>
        }
      />

      {courses.data && courses.data.length > 1 && courseId ? (
        <Card density="compact">
          <div className="w-full sm:w-72">
            <SelectField
              id="practice-course"
              label="Course"
              value={courseId}
              options={courses.data.map((c) => ({ value: c.id, label: c.title }))}
              onChange={setCourseId}
            />
          </div>
        </Card>
      ) : null}

      {overview.errorStatus !== null ? (
        <ErrorPanel status={overview.errorStatus} onRetry={overview.reload} />
      ) : !data || overview.loading ? (
        <LoadingPanel />
      ) : (
        <>
          <WeakTopicsCard
            topics={data.weakTopics.filter((t) => !studied.has(t.topicId))}
            onStudied={(id) => setStudied((prev) => new Set(prev).add(id))}
          />
          {categories.length === 0 ? (
            <Card>
              <EmptyState
                icon={ListChecks}
                heading="No practice tests yet"
                body="Tests appear here once they're published."
              />
            </Card>
          ) : (
            <Card density="compact" className="p-0">
              <div
                role="tablist"
                aria-label="Practice categories"
                className="flex flex-wrap gap-1 border-b border-neutral-200 px-2 pt-2 dark:border-neutral-800"
              >
                {categories.map((c) => {
                  const selected = c.id === active?.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setTab(c.id)}
                      className={cn(
                        "-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                        selected
                          ? "border-primary-600 text-primary-700 dark:text-primary-300"
                          : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white/90",
                      )}
                    >
                      {c.title}
                      <span className="ml-1.5 text-xs text-neutral-400">{c.tests.length}</span>
                    </button>
                  );
                })}
              </div>
              {active && courseId ? (
                <div role="tabpanel">
                  <TestPerformanceChart
                    courseId={courseId}
                    categoryId={active.id}
                    categoryTitle={active.title}
                  />
                  {active.description ? (
                    <p className="px-4 pt-3 text-sm text-neutral-500 dark:text-neutral-400">
                      {active.description}
                    </p>
                  ) : null}
                  <PaperFilters
                    tests={active.tests}
                    exam={examFilter}
                    year={yearFilter}
                    onExam={setExamFilter}
                    onYear={setYearFilter}
                  />
                  {(() => {
                    const shown = active.tests.filter(
                      (t) =>
                        (!examFilter || t.exam === examFilter) &&
                        (!yearFilter || String(t.paperYear) === yearFilter),
                    );
                    if (active.tests.length === 0)
                      return (
                        <EmptyState icon={ListChecks} heading="No tests in this category yet" />
                      );
                    if (shown.length === 0)
                      return <EmptyState heading="No papers match these filters" />;
                    return (
                      <ul className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
                        {shown.map((t) => (
                          <TestRow key={t.id} test={t} />
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              ) : null}
            </Card>
          )}
        </>
      )}
    </main>
  );
}

export default function PracticePage() {
  return (
    <RequireAuth>
      <PracticeContent />
    </RequireAuth>
  );
}
