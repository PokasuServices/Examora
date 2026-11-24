"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  ClipboardList,
  Flag,
  Landmark,
  Settings,
  Target,
} from "lucide-react";
import type { GoalView } from "@examora/types";
import { Button, Input, cn } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { SubmissionStatusChip } from "@/components/assignment/submission-status-chip";
import { StudyImage } from "@/components/student/study-image";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { useLicensedCourse } from "@/components/student/use-licensed-course";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/select-field";
import { METHOD_LABEL, useStudentApi } from "@/lib/student-api";

const TABS = [
  "Activity",
  "Performance",
  "Uploads & assignments",
  "Revision",
  "Goals",
  "Checkpoints",
  "Shortlisted colleges",
] as const;
type Tab = (typeof TABS)[number];

/** Fixed categorical colours for answer methods (same order everywhere). */
const METHOD_FILL = { KNOWLEDGE: "#2563eb", ELIMINATION: "#f59e0b", GUESS: "#f43f5e" } as const;

function ActivityTab() {
  const api = useStudentApi();
  const { data, errorStatus, reload } = useLoad(() => api.activity(), "activity");
  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (!data) return <LoadingPanel />;
  if (data.length === 0)
    return (
      <EmptyState heading="No activity yet" body="Lessons, tests and XP you earn appear here." />
    );
  const byDay = new Map<string, typeof data>();
  for (const item of data) {
    const day = new Date(item.at).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }
  return (
    <ol className="flex flex-col gap-5">
      {[...byDay.entries()].map(([day, items]) => (
        <li key={day}>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{day}</p>
          <ul className="mt-2 flex flex-col gap-1.5 border-l-2 border-neutral-200 pl-4 dark:border-neutral-800">
            {items.map((i, n) => (
              <li key={`${i.at}-${n}`} className="text-sm">
                <span className="text-neutral-800 dark:text-white/90">{i.title}</span>
                {i.detail ? <span className="text-neutral-500"> · {i.detail}</span> : null}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function PerformanceTab() {
  const api = useStudentApi();
  const { courses, courseId, setCourseId } = useLicensedCourse();
  const practice = useLoad(() => api.practice(courseId!), courseId ? `cats-${courseId}` : null);
  const [category, setCategory] = React.useState("");
  const perf = useLoad(
    () => api.performance(courseId!, category || undefined),
    courseId ? `${courseId}-${category}` : null,
  );
  const data = (perf.data ?? []).map((p) => ({
    name: p.quizTitle,
    ...p.byMethod,
    total: p.percent,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        {courses.data && courseId ? (
          <div className="w-full sm:w-64">
            <SelectField
              id="perf-course"
              label="Course"
              value={courseId}
              options={courses.data.map((c) => ({ value: c.id, label: c.title }))}
              onChange={(v) => {
                setCourseId(v);
                setCategory("");
              }}
            />
          </div>
        ) : null}
        {practice.data ? (
          <div className="w-full sm:w-56">
            <SelectField
              id="perf-category"
              label="Tests"
              value={category}
              options={[
                { value: "", label: "All practice tests" },
                ...practice.data.categories.map((c) => ({ value: c.id, label: c.title })),
              ]}
              onChange={setCategory}
            />
          </div>
        ) : null}
      </div>
      {perf.loading ? (
        <LoadingPanel />
      ) : data.length === 0 ? (
        <EmptyState
          heading="No tests finished yet"
          body="Your first attempt at each practice test is charted here."
          actionLabel="Go to practice"
          actionHref="/practice"
        />
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            First attempt at each test: % of marks, split by how you got the answers.
          </p>
          <div className="h-72 w-full text-neutral-500" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.15} />
                <XAxis dataKey="name" tick={{ fill: "currentColor", fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "currentColor", fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(v) => `${String(v)}%`}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {(["KNOWLEDGE", "ELIMINATION", "GUESS"] as const).map((m) => (
                  <Bar
                    key={m}
                    dataKey={m}
                    name={METHOD_LABEL[m]}
                    stackId="score"
                    fill={METHOD_FILL[m]}
                    stroke="#fff"
                    strokeWidth={1}
                    maxBarSize={48}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="w-full text-sm">
            <caption className="sr-only">Test scores by answer method</caption>
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th scope="col" className="py-1 font-medium">
                  Test
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Score
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Knew it
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Ruled out
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Guessed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {data.map((d) => (
                <tr key={d.name}>
                  <th scope="row" className="py-1.5 text-left font-normal">
                    {d.name}
                  </th>
                  <td className="py-1.5 text-right tabular-nums">{d.total}%</td>
                  <td className="py-1.5 text-right tabular-nums">{d.KNOWLEDGE}%</td>
                  <td className="py-1.5 text-right tabular-nums">{d.ELIMINATION}%</td>
                  <td className="py-1.5 text-right tabular-nums">{d.GUESS}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function RevisionTab() {
  const api = useStudentApi();
  const { data, errorStatus, reload } = useLoad(() => api.revision(), "revision");
  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (!data) return <LoadingPanel />;
  const flagged = data.filter((d) => d.kind === "FLAGGED");
  const topics = data.filter((d) => d.kind === "WEAK_TOPIC");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-white/90">
          <Flag size={14} aria-hidden="true" /> Questions you flagged
        </h3>
        {flagged.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Flag questions during a test to revisit them here.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {flagged.map((f) => (
              <li key={`${f.attemptId}-${f.questionId}`}>
                <Link
                  href={`/quizzes/attempts/${f.attemptId}/review`}
                  className="block rounded-md border border-neutral-200 p-3 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-white/[0.03]"
                >
                  <span className="line-clamp-2 text-neutral-800 dark:text-white/90">
                    {f.questionText}
                  </span>
                  <span className="text-xs text-neutral-500">{f.quizTitle}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-white/90">
          <BookOpen size={14} aria-hidden="true" /> Topics to revise
        </h3>
        {topics.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Topics with wrong answers appear here.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {topics.map((t) => (
              <li key={t.topicId}>
                <Link
                  href={`/learn/topics/${t.topicId}`}
                  className="flex justify-between rounded-md border border-neutral-200 p-3 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-white/[0.03]"
                >
                  <span className="text-neutral-800 dark:text-white/90">{t.topicTitle}</span>
                  <span className="text-xs text-neutral-500">{t.subjectTitle}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function GoalRow({ goal, onSaved }: { goal: GoalView; onSaved: () => void }) {
  const api = useStudentApi();
  const [target, setTarget] = React.useState(goal.targetPercent?.toString() ?? "");
  const [state, setState] = React.useState<"idle" | "saving" | "error">("idle");
  const value = Number(target);
  const valid = Number.isInteger(value) && value >= 1 && value <= 100;
  const progress =
    goal.targetPercent && goal.currentPercent !== null
      ? Math.min(100, Math.round((goal.currentPercent / goal.targetPercent) * 100))
      : null;
  return (
    <li className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-800 dark:text-white/90">
            {goal.courseTitle}
          </p>
          <p className="text-xs text-neutral-500">
            Recent tests average:{" "}
            {goal.currentPercent === null ? "no tests yet" : `${goal.currentPercent}%`}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`goal-${goal.courseId}`} className="text-xs text-neutral-500">
              Target %
            </label>
            <Input
              id={`goal-${goal.courseId}`}
              inputMode="numeric"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-20"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!valid || state === "saving" || value === goal.targetPercent}
            onClick={async () => {
              setState("saving");
              try {
                await api.setGoal(goal.courseId, value);
                setState("idle");
                onSaved();
              } catch {
                setState("error");
              }
            }}
          >
            Save
          </Button>
        </div>
      </div>
      {progress !== null ? (
        <div className="mt-3">
          <div
            className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10"
            role="progressbar"
            aria-label="Progress to goal"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn(
                "h-full rounded-full",
                progress >= 100 ? "bg-success-500" : "bg-primary-600",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {progress >= 100
              ? "Goal reached. Consider raising it."
              : `${progress}% of the way to your target`}
          </p>
        </div>
      ) : null}
      {state === "error" ? (
        <p className="mt-2 text-xs text-danger-600">Couldn&rsquo;t save.</p>
      ) : null}
    </li>
  );
}

function GoalsTab() {
  const api = useStudentApi();
  const { data, errorStatus, reload } = useLoad(() => api.goals(), "goals");
  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (!data) return <LoadingPanel />;
  const shown = data.filter((g) => g.targetPercent !== null || g.currentPercent !== null);
  const list = shown.length > 0 ? shown : data.slice(0, 3);
  return (
    <ul className="flex flex-col gap-3">
      {list.map((g) => (
        <GoalRow key={g.courseId} goal={g} onSaved={reload} />
      ))}
    </ul>
  );
}

function CheckpointsTab() {
  const api = useStudentApi();
  const { data, errorStatus, reload } = useLoad(() => api.checkpoints(), "checkpoints");
  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (!data) return <LoadingPanel />;
  if (data.length === 0)
    return (
      <EmptyState
        heading="No checkpoints yet"
        body="Your institute can add milestones for each course."
      />
    );
  return (
    <ul className="flex flex-col gap-2">
      {data.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            aria-pressed={c.done}
            onClick={async () => {
              await api.setCheckpoint(c.id, !c.done).catch(() => undefined);
              reload();
            }}
            className="flex w-full items-center gap-3 rounded-md border border-neutral-200 p-3 text-left text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-white/[0.03]"
          >
            {c.done ? (
              <CheckCircle2 size={20} className="text-success-600" aria-hidden="true" />
            ) : (
              <Circle size={20} className="text-neutral-300" aria-hidden="true" />
            )}
            <span className="flex-1">
              <span
                className={cn(
                  "block",
                  c.done ? "text-neutral-500 line-through" : "text-neutral-800 dark:text-white/90",
                )}
              >
                {c.title}
              </span>
              <span className="block text-xs text-neutral-500">{c.courseTitle}</span>
            </span>
            {c.dueDate ? (
              <Chip tone={c.done ? "neutral" : "warning"}>
                Due{" "}
                {new Date(c.dueDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </Chip>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Everything the student has handed in: assignment submissions and test sketches. */
function UploadsTab() {
  const api = useStudentApi();
  const { data, errorStatus, reload } = useLoad(
    () => Promise.all([api.mySubmissions(), api.mySketches()]),
    "uploads",
  );
  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (!data) return <LoadingPanel />;
  const [submissions, sketches] = data;
  // Latest version per assignment only.
  const latest = new Map<string, (typeof submissions)[number]>();
  for (const sub of submissions) {
    const seen = latest.get(sub.assignmentId);
    if (!seen || sub.version > seen.version) latest.set(sub.assignmentId, sub);
  }
  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-neutral-800 dark:text-white/90">Assignments</h3>
          <Link
            href="/assignments"
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            All assignments
          </Link>
        </div>
        {latest.size === 0 ? (
          <EmptyState
            icon={ClipboardList}
            heading="Nothing handed in yet"
            body="Assignments you start or submit appear here with their status and marks."
            actionLabel="Browse assignments"
            actionHref="/assignments"
          />
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {[...latest.values()].map((sub) => (
              <li key={sub.id}>
                <Link
                  href={`/assignments/submission/${sub.id}`}
                  className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm hover:bg-neutral-50 dark:hover:bg-white/[0.03]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-neutral-800 dark:text-white/90">
                      {sub.assignmentTitle}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      Version {sub.version}
                      {sub.submittedAt
                        ? ` · submitted ${new Date(sub.submittedAt).toLocaleDateString("en-IN")}`
                        : ""}
                    </span>
                  </span>
                  {sub.obtainedMarks !== null ? (
                    <span className="text-sm font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
                      {sub.obtainedMarks} marks
                    </span>
                  ) : null}
                  <SubmissionStatusChip status={sub.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-neutral-800 dark:text-white/90">Test sketches</h3>
          <Link href="/sketches" className="text-sm font-medium text-primary-600 hover:underline">
            Rate and compare
          </Link>
        </div>
        {sketches.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Sketches you upload during tests appear here.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sketches.map((k) => (
              <li key={k.answerId}>
                <Link
                  href="/sketches"
                  className="block overflow-hidden rounded-md border border-neutral-200 hover:border-primary-300 dark:border-neutral-800"
                >
                  <StudyImage
                    src={k.imageRef}
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <span className="block px-2 py-1.5 text-xs">
                    <span className="line-clamp-1 text-neutral-700 dark:text-neutral-300">
                      {k.questionText}
                    </span>
                    <span className="text-neutral-500">
                      {k.marksAwarded !== null
                        ? `${k.marksAwarded} / ${k.marks} marks`
                        : k.selfScores
                          ? "Waiting for expert"
                          : "Rate yourself"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CollegesTab() {
  const api = useStudentApi();
  const { data, errorStatus, reload } = useLoad(() => api.shortlist(), "shortlist");
  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (!data) return <LoadingPanel />;
  if (data.length === 0)
    return (
      <EmptyState
        icon={Landmark}
        heading="No colleges shortlisted"
        body="Shortlist colleges while you explore to keep them here."
        actionLabel="Explore colleges"
        actionHref="/colleges"
      />
    );
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((c) => (
        <li
          key={c.id}
          className="flex items-start gap-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
        >
          <span className="min-w-0 flex-1">
            <Link
              href={`/colleges/${c.slug}`}
              className="block truncate text-sm font-medium text-neutral-800 hover:text-primary-600 dark:text-white/90"
            >
              {c.name}
            </Link>
            <span className="block text-xs text-neutral-500">
              {c.city}
              {c.applicationFee !== null
                ? ` · fee ₹${c.applicationFee.toLocaleString("en-IN")}`
                : ""}
            </span>
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await api.setShortlisted(c.id, false).catch(() => undefined);
              reload();
            }}
          >
            Remove
          </Button>
        </li>
      ))}
    </ul>
  );
}

function ProfileContent() {
  const api = useStudentApi();
  const { data, errorStatus, loading, reload } = useLoad(() => api.profile(), "profile");
  const [tab, setTab] = React.useState<Tab>("Activity");
  // Deep links such as /me?tab=performance open a tab directly.
  React.useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("tab")?.toLowerCase();
    if (!key) return;
    const match = TABS.find((t) => t.toLowerCase().startsWith(key));
    if (match) setTab(match);
  }, []);
  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !data) return <LoadingPanel />;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="My profile"
        actions={
          <div className="flex gap-2">
            <Link
              href="/sketches"
              className="inline-flex h-10 items-center rounded-md border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300"
            >
              My sketches
            </Link>
            <Link
              href="/profile"
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300"
            >
              <Settings size={16} aria-hidden="true" /> Settings
            </Link>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <p className="text-xl font-semibold text-neutral-800 dark:text-white/90">{data.name}</p>
          <p className="text-sm text-neutral-500">{data.email}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip tone="warning">{data.totalXp.toLocaleString("en-IN")} XP</Chip>
            {data.examYear ? (
              <Chip tone="primary">
                <Target size={12} aria-hidden="true" className="mr-1 inline" />
                Exam {data.examYear}
              </Chip>
            ) : null}
            {data.cohorts.map((c) => (
              <Chip key={c.id} tone="neutral">
                {c.name}
              </Chip>
            ))}
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Courses
          </p>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            {data.courses.map((c) => c.title).join(" · ") || "No courses assigned yet"}
          </p>
        </Card>
        <Card>
          <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">
            From your mentor
          </h2>
          {data.mentorComments.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No comments yet.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-3">
              {data.mentorComments.slice(0, 3).map((c) => (
                <li key={c.id} className="text-sm">
                  <p className="text-neutral-700 dark:text-neutral-300">{c.body}</p>
                  <p className="text-xs text-neutral-500">
                    {c.mentorName} · {new Date(c.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card density="compact" className="p-0">
        <div
          role="tablist"
          aria-label="Profile sections"
          className="flex flex-wrap gap-1 border-b border-neutral-200 px-2 pt-2 dark:border-neutral-800"
        >
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                tab === t
                  ? "border-primary-600 text-primary-700 dark:text-primary-300"
                  : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="p-4 sm:p-6">
          {tab === "Activity" ? <ActivityTab /> : null}
          {tab === "Performance" ? <PerformanceTab /> : null}
          {tab === "Uploads & assignments" ? <UploadsTab /> : null}
          {tab === "Revision" ? <RevisionTab /> : null}
          {tab === "Goals" ? <GoalsTab /> : null}
          {tab === "Checkpoints" ? <CheckpointsTab /> : null}
          {tab === "Shortlisted colleges" ? <CollegesTab /> : null}
        </div>
      </Card>
    </main>
  );
}

export default function MyProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}
