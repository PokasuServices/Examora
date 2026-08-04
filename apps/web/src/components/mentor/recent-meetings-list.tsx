import Link from "next/link";
import { Users as UsersIcon } from "lucide-react";
import type { AssignedStudentSummary, MentorMeeting } from "@examora/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * "Recent Meetings," not "Upcoming Meetings" — MentorMeeting only records
 * meetings that already happened (occurredAt + summary, written after the
 * fact). No scheduling/future-meetings data exists anywhere in the backend.
 * MentorMeeting carries mentorEmail (always the viewer) but no student
 * name/email — resolved here from the already-fetched assignedStudents list.
 */
export function RecentMeetingsList({
  meetings,
  students,
}: {
  meetings: MentorMeeting[];
  students: AssignedStudentSummary[];
}) {
  const studentById = new Map(students.map((s) => [s.studentId, s]));

  return (
    <section aria-labelledby="recent-meetings-heading">
      <h2
        id="recent-meetings-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Recent Meetings
      </h2>
      <Card className="mt-3">
        {meetings.length === 0 ? (
          <EmptyState icon={UsersIcon} heading="No meetings logged yet" />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {meetings.slice(0, 5).map((m) => {
              const student = studentById.get(m.studentId);
              return (
                <li key={m.id} className="py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/mentor/students/${m.studentId}`}
                      className="font-medium text-neutral-800 hover:text-primary-600 hover:underline"
                    >
                      {student
                        ? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() ||
                          student.studentEmail
                        : "Student"}
                    </Link>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {new Date(m.occurredAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      {m.durationMinutes ? ` · ${m.durationMinutes} min` : ""}
                    </span>
                  </div>
                  {m.summary ? <p className="mt-1 truncate text-neutral-500">{m.summary}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
