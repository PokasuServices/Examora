import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { MergedStudent } from "./use-mentor-students";
import { ActivityBadge } from "./activity-badge";

function ProgressCell({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
        <div className="h-full rounded-full bg-primary-600" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-9 shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
        {percent}%
      </span>
    </div>
  );
}

function formatAvg(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function formatLastActive(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Real `<table>` for sm+, stacked cards below — same responsive-table pattern used nowhere else yet in apps/web, but matches the "beautiful searchable table/cards" requirement directly. */
export function StudentTable({ students }: { students: MergedStudent[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-soft sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-neutral-800 text-xs font-medium text-neutral-400 dark:text-neutral-500">
              <th scope="col" className="px-5 py-3">
                Student
              </th>
              <th scope="col" className="px-3 py-3">
                Progress
              </th>
              <th scope="col" className="px-3 py-3">
                Assignment Avg
              </th>
              <th scope="col" className="px-3 py-3">
                Quiz Avg
              </th>
              <th scope="col" className="px-3 py-3">
                Last Activity
              </th>
              <th scope="col" className="px-3 py-3">
                Status
              </th>
              <th scope="col" className="px-5 py-3">
                <span className="sr-only">View</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {students.map((s) => (
              <tr key={s.studentId} className="hover:bg-neutral-50 dark:hover:bg-white/[0.03]">
                <td className="px-5 py-3">
                  <p className="font-medium text-neutral-800 dark:text-white/90">{s.name}</p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">{s.email}</p>
                </td>
                <td className="px-3 py-3">
                  <ProgressCell percent={s.overallCompletionPercent} />
                </td>
                <td className="px-3 py-3 tabular-nums text-neutral-600 dark:text-neutral-400">
                  {formatAvg(s.assignmentAverage)}
                </td>
                <td className="px-3 py-3 tabular-nums text-neutral-600 dark:text-neutral-400">
                  {formatAvg(s.quizAverage)}
                </td>
                <td className="px-3 py-3 text-neutral-500 dark:text-neutral-400">
                  {formatLastActive(s.lastActiveAt)}
                </td>
                <td className="px-3 py-3">
                  <ActivityBadge lastActiveAt={s.lastActiveAt} />
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/mentor/students/${s.studentId}`}
                    aria-label={`View ${s.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-primary-600 dark:hover:text-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 sm:hidden">
        {students.map((s) => (
          <li key={s.studentId}>
            <Link
              href={`/mentor/students/${s.studentId}`}
              className="block rounded-card border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-800 dark:text-white/90">
                    {s.name}
                  </p>
                  <p className="truncate text-xs text-neutral-400 dark:text-neutral-500">
                    {s.email}
                  </p>
                </div>
                <ActivityBadge lastActiveAt={s.lastActiveAt} />
              </div>
              <div className="mt-3">
                <ProgressCell percent={s.overallCompletionPercent} />
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                <span>Assignment {formatAvg(s.assignmentAverage)}</span>
                <span>Quiz {formatAvg(s.quizAverage)}</span>
                <span>Active {formatLastActive(s.lastActiveAt)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
