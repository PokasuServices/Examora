"use client";

import * as React from "react";
import {
  CalendarCheck,
  Clock,
  FileText,
  GraduationCap,
  HelpCircle,
  Inbox,
  ListChecks,
  Sparkles,
  Users,
} from "lucide-react";
import type { MentorWorkloadView } from "@examora/types";
import { useAuth } from "@examora/auth-client";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RetryInline } from "@/components/ui/retry-inline";
import { SectionTitle, StatTile, ToneCard } from "@/components/desk-ui";
import { useDeskApi } from "@/lib/desk-api";

export function hours(h: number | null): string {
  if (h === null) return "—";
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} days`;
}

export function WorkloadTiles({ w }: { w: MentorWorkloadView }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        index={0}
        tone="indigo"
        icon={Users}
        label="Batches"
        value={w.batches}
        hint={`${w.students} students`}
      />
      <StatTile
        index={1}
        tone="cyan"
        icon={CalendarCheck}
        label="Classes a week"
        value={w.classesPerWeek}
        hint={`${w.attendanceMarked30} marked in 30 days${w.attendancePending ? ` · ${w.attendancePending} pending` : ""}`}
      />
      <StatTile
        index={2}
        tone="violet"
        icon={Inbox}
        label="Waiting to mark"
        value={w.pendingReviews}
        hint={`${w.reviewedLast30} marked in 30 days`}
      />
      <StatTile
        index={3}
        tone="emerald"
        icon={Clock}
        label="Marking time"
        value={hours(w.avgTurnaroundHours)}
        hint="Average, last 30 days"
      />
      <StatTile
        index={4}
        tone="amber"
        icon={HelpCircle}
        label="Doubts answered"
        value={w.doubtsAnswered30}
        hint={`Avg reply ${hours(w.avgDoubtResponseHours)}`}
      />
      <StatTile
        index={5}
        tone="rose"
        icon={FileText}
        label="Reports sent"
        value={w.reportsSubmitted30}
        hint="Last 30 days"
      />
      <StatTile
        index={6}
        tone="violet"
        icon={Sparkles}
        label="Shout-outs"
        value={w.shoutouts30}
        hint="Last 30 days"
      />
      <StatTile
        index={7}
        tone="indigo"
        icon={ListChecks}
        label="Tests published"
        value={w.quizzesPublished30}
        hint="Last 30 days"
      />
    </div>
  );
}

function ProfileContent() {
  const api = useDeskApi();
  const { user } = useAuth();
  const [w, setW] = React.useState<MentorWorkloadView | null>(null);
  const [error, setError] = React.useState(false);
  const load = React.useCallback(() => {
    setError(false);
    api
      .workload()
      .then(setW)
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => load(), [load]);
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="My profile & workload"
        subtitle="Your batches and how the last 30 days went."
      />
      <ToneCard tone="indigo" className="flex items-center gap-4 p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-lg font-semibold text-white">
          {(w?.mentor.name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div>
          <p className="font-heading text-lg font-semibold">{w?.mentor.name ?? "…"}</p>
          <p className="text-sm text-neutral-500">{user?.email}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-indigo-700 dark:text-indigo-300">
            <GraduationCap size={12} aria-hidden="true" /> Mentor
          </p>
        </div>
      </ToneCard>
      {error ? (
        <RetryInline message="Couldn't load your workload" onRetry={load} />
      ) : !w ? (
        <Card className="text-sm text-neutral-500">Loading…</Card>
      ) : (
        <WorkloadTiles w={w} />
      )}
      <section>
        <SectionTitle>What you can do here</SectionTitle>
        <Card className="text-sm text-neutral-600 dark:text-neutral-300">
          You manage the batches and courses the admin gives you: attendance, marking, doubts, tests
          and assignments, daily quizzes, reports, shout-outs and announcements. Fixed course
          content and deletions go to the admin for review; accounts, licences and payments stay
          with the admin.
        </Card>
      </section>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <RequirePermission permission="mentor:workflow">
      <ProfileContent />
    </RequirePermission>
  );
}
