import Link from "next/link";
import { Activity } from "lucide-react";
import type { MentorStudentProgressEntry } from "@examora/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ActivityBadge } from "./activity-badge";

/**
 * Stands in for "Recent Activity Timeline" across the whole caseload. A true
 * cross-student event feed (lesson completed, quiz taken, etc.) doesn't
 * exist as a single endpoint — Student360Service builds a rich timeline,
 * but only one student at a time; assembling it for every assigned student
 * here would mean one extra API call per student, which doesn't scale (see
 * Performance Considerations in the report). This uses lastActiveAt — real
 * data already fetched for the Student List — ranked most-recent first, an
 * honest "who touched the platform, and when" view rather than a fabricated
 * event stream. The full per-student timeline lives on Student 360.
 */
export function RecentlyActiveStudents({ entries }: { entries: MentorStudentProgressEntry[] }) {
  const sorted = [...entries]
    .filter((e) => e.lastActiveAt !== null)
    .sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? ""))
    .slice(0, 6);

  return (
    <section aria-labelledby="recently-active-heading">
      <h2
        id="recently-active-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Recently Active Students
      </h2>
      <Card className="mt-3">
        {sorted.length === 0 ? (
          <EmptyState icon={Activity} heading="No activity recorded yet" />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {sorted.map((entry) => (
              <li key={entry.studentId}>
                <Link
                  href={`/mentor/students/${entry.studentId}`}
                  className="flex items-center justify-between gap-3 rounded-md py-2.5 text-sm hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <span className="min-w-0 truncate font-medium text-neutral-800">
                    {entry.studentName ?? entry.studentEmail}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-neutral-400">
                      {new Date(entry.lastActiveAt!).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <ActivityBadge lastActiveAt={entry.lastActiveAt} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
