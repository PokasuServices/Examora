"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, CheckSquare, Users } from "lucide-react";
import type { MentorDashboard, MentorTaskStatus } from "@examora/types";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/format";
import { useMentorApi } from "@/lib/mentor-api";

const TASK_STATUS_TONE: Record<MentorTaskStatus, ChipTone> = {
  PENDING: "neutral",
  IN_PROGRESS: "primary",
  COMPLETED: "success",
};

function MentorDashboardContent() {
  const api = useMentorApi();
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [dashboard, setDashboard] = React.useState<MentorDashboard | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    api
      .getMentorDashboard()
      .then((res) => {
        setDashboard(res);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (status === "loading") {
    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-64" />
        <Card>
          <Skeleton className="h-24 w-full" />
        </Card>
        <Card>
          <Skeleton className="h-24 w-full" />
        </Card>
      </main>
    );
  }

  if (status === "error" || !dashboard) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <RetryInline message="Couldn't load your mentor dashboard" onRetry={load} />
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="My mentor dashboard"
        subtitle={`${dashboard.assignedStudents.length} / ${dashboard.profile.maxStudents} students · ${dashboard.pendingTaskCount} pending task${dashboard.pendingTaskCount === 1 ? "" : "s"}`}
      />

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">My students</h2>
        {dashboard.assignedStudents.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-100">
            {dashboard.assignedStudents.map((s) => (
              <li
                key={s.studentId}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
              >
                <Link
                  href={`/students/${s.studentId}`}
                  className="font-medium text-primary-600 hover:underline"
                >
                  {s.studentEmail}
                </Link>
                <span className="text-neutral-400">
                  since {new Date(s.assignedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Users} heading="No students assigned to you yet" />
        )}
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Upcoming tasks</h2>
        {dashboard.upcomingTasks.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-100">
            {dashboard.upcomingTasks.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
              >
                <span className="text-neutral-700">
                  {t.title}{" "}
                  {t.dueDate ? (
                    <span className="text-neutral-400">
                      (due {new Date(t.dueDate).toLocaleDateString()})
                    </span>
                  ) : null}
                </span>
                <Chip tone={TASK_STATUS_TONE[t.status]}>{statusLabel(t.status)}</Chip>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CheckSquare} heading="No pending tasks" />
        )}
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-neutral-900">Recent meetings</h2>
        {dashboard.recentMeetings.length > 0 ? (
          <ul className="mt-4 divide-y divide-neutral-100">
            {dashboard.recentMeetings.map((m) => (
              <li key={m.id} className="py-2.5 text-sm">
                <p className="text-neutral-700">{new Date(m.occurredAt).toLocaleString()}</p>
                {m.summary ? <p className="mt-0.5 text-neutral-500">{m.summary}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CalendarClock} heading="No meetings logged yet" />
        )}
      </Card>
    </main>
  );
}

export default function MentorDashboardPage() {
  return (
    <RequirePermission permission="mentor:workflow">
      <MentorDashboardContent />
    </RequirePermission>
  );
}
