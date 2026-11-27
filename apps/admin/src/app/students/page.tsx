"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, FileText, PauseCircle, Search, Sparkles, Users } from "lucide-react";
import type { BatchProgressView, CohortView } from "@examora/types";
import { Input, cn } from "@examora/ui";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { Meter, Pill, SectionTitle, StatTile, percentTone, timeAgo } from "@/components/desk-ui";
import { useDeskApi } from "@/lib/desk-api";
import { useStudentAdminApi } from "@/lib/student-admin-api";

const selectCls =
  "h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

function StudentsContent() {
  const api = useDeskApi();
  const studentApi = useStudentAdminApi();
  const [batches, setBatches] = React.useState<CohortView[] | null>(null);
  const [cohortId, setCohortId] = React.useState("");
  const [data, setData] = React.useState<BatchProgressView | null>(null);
  const [error, setError] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<"progress" | "attendance" | "quiz" | "name">("progress");

  React.useEffect(() => {
    studentApi
      .cohorts()
      .then((b) => {
        const active = b.filter((x) => x.isActive);
        setBatches(active);
        setCohortId(active[0]?.id ?? "");
      })
      .catch(() => setBatches([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const load = React.useCallback(() => {
    if (!cohortId) return;
    setError(false);
    setData(null);
    api
      .batchProgress(cohortId)
      .then(setData)
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId]);
  React.useEffect(() => load(), [load]);

  const students = (data?.students ?? [])
    .filter((s) => !search || `${s.name} ${s.email}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "attendance"
          ? (a.attendancePercent ?? -1) - (b.attendancePercent ?? -1)
          : sort === "quiz"
            ? (a.avgQuizPercent ?? -1) - (b.avgQuizPercent ?? -1)
            : b.percent - a.percent,
    );
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="My students"
        subtitle="How each batch is moving through the course, and every student at a glance. Open a student for their full picture."
      />
      <Card density="compact" className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Batch"
          className={selectCls}
          value={cohortId}
          onChange={(e) => setCohortId(e.target.value)}
        >
          {(batches ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search
            size={14}
            aria-hidden="true"
            className="absolute left-2.5 top-2.5 text-neutral-400"
          />
          <Input
            aria-label="Search students"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students"
            className="h-9 w-56 pl-8 text-sm"
          />
        </div>
      </Card>
      {error ? (
        <RetryInline message="Couldn't load the batch" onRetry={load} />
      ) : !data ? (
        <Card className="text-sm text-neutral-500">
          {batches && batches.length === 0 ? "You have no batches yet." : "Loading…"}
        </Card>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              index={0}
              tone="indigo"
              icon={Users}
              label="Students"
              value={data.students.length}
              hint={data.courseTitle ?? undefined}
            />
            <StatTile
              index={1}
              tone="violet"
              icon={BookOpen}
              label="Course progress"
              value={`${avg(data.students.map((s) => s.percent)) ?? 0}%`}
              hint={`${data.lessonsTotal} lessons`}
            />
            <StatTile
              index={2}
              tone={percentTone(avg(data.students.map((s) => s.attendancePercent)))}
              icon={Users}
              label="Attendance"
              value={`${avg(data.students.map((s) => s.attendancePercent)) ?? "—"}%`}
              hint="Last 30 days"
            />
            <StatTile
              index={3}
              tone="amber"
              icon={PauseCircle}
              label="Topics on hold"
              value={data.topics.reduce((n, t) => n + t.onHold, 0)}
              hint="Students put these aside"
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <section>
              <SectionTitle
                action={
                  <select
                    aria-label="Sort"
                    className={cn(selectCls, "h-8 text-xs")}
                    value={sort}
                    onChange={(e) => setSort(e.target.value as typeof sort)}
                  >
                    <option value="progress">Most progress first</option>
                    <option value="attendance">Lowest attendance first</option>
                    <option value="quiz">Lowest quiz score first</option>
                    <option value="name">Name</option>
                  </select>
                }
              >
                Students
              </SectionTitle>
              <Card density="compact" className="overflow-x-auto p-0">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-white/[0.03]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Student</th>
                      <th className="px-3 py-2 font-medium">Course</th>
                      <th className="px-3 py-2 font-medium">Attendance</th>
                      <th className="px-3 py-2 font-medium">Quiz avg</th>
                      <th className="px-3 py-2 font-medium">Last active</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr
                        key={s.userId}
                        className="border-t border-neutral-100 dark:border-neutral-800"
                      >
                        <td className="px-3 py-2">
                          <Link
                            href={`/students/${s.userId}`}
                            className="font-medium text-neutral-900 hover:underline dark:text-white"
                          >
                            {s.name}
                          </Link>
                          <p className="text-xs text-neutral-500">{s.email}</p>
                        </td>
                        <td className="min-w-[8rem] px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Meter value={s.percent} tone="violet" />
                            <span className="w-9 text-right text-xs">{s.percent}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Pill tone={percentTone(s.attendancePercent)}>
                            {s.attendancePercent === null ? "—" : `${s.attendancePercent}%`}
                          </Pill>
                        </td>
                        <td className="px-3 py-2">
                          <Pill tone={percentTone(s.avgQuizPercent)}>
                            {s.avgQuizPercent === null ? "—" : `${s.avgQuizPercent}%`}
                          </Pill>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">
                          {s.lastActiveAt ? timeAgo(s.lastActiveAt) : "Never"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <Link
                            href={`/student-reports?new=MONTHLY&student=${s.userId}`}
                            title="Write a report"
                            className="mr-2 inline-flex text-neutral-400 hover:text-primary-600"
                          >
                            <FileText size={15} aria-hidden="true" />
                            <span className="sr-only">Write a report for {s.name}</span>
                          </Link>
                          <Link
                            href="/shoutouts"
                            title="Give a shout-out"
                            className="inline-flex text-neutral-400 hover:text-violet-600"
                          >
                            <Sparkles size={15} aria-hidden="true" />
                            <span className="sr-only">Give {s.name} a shout-out</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>
            <section>
              <SectionTitle>Topics</SectionTitle>
              <Card density="compact">
                <ul className="flex max-h-[34rem] flex-col gap-3 overflow-y-auto pr-1">
                  {data.topics.map((t) => (
                    <li key={t.topicId}>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium">{t.title}</p>
                        <span className="text-xs font-semibold">{t.completedPercent}%</span>
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        {t.subjectTitle}
                        {t.started ? ` · ${t.started} in progress` : ""}
                        {t.onHold ? ` · ${t.onHold} on hold` : ""}
                      </p>
                      <div className="mt-1">
                        <Meter
                          value={t.completedPercent}
                          tone={
                            t.completedPercent >= 60
                              ? "emerald"
                              : t.completedPercent >= 30
                                ? "cyan"
                                : "amber"
                          }
                          label={`${t.title} completion`}
                        />
                      </div>
                    </li>
                  ))}
                  {data.topics.length === 0 ? (
                    <li className="text-sm text-neutral-500">No published lessons yet.</li>
                  ) : null}
                </ul>
              </Card>
            </section>
          </div>
        </>
      )}
    </main>
  );
}

export default function StudentsPage() {
  return (
    <RequirePermission permission="mentor:workflow">
      <StudentsContent />
    </RequirePermission>
  );
}
