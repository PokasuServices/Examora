"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Lock } from "lucide-react";
import type { SketchWorkView } from "@examora/types";
import { RequireAuth } from "@/components/require-auth";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { SketchWorkPanel } from "@/components/student/sketch-work";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useStudentApi } from "@/lib/student-api";

/** A classmate's sketch: versions, pins, comments, claps and your feedback. */
function WorkContent() {
  const { workId } = useParams<{ workId: string }>();
  const api = useStudentApi();
  const { data, errorStatus, loading, reload } = useLoad(() => api.sketchWork(workId), workId);
  const [work, setWork] = React.useState<SketchWorkView | null>(null);
  React.useEffect(() => setWork(data), [data]);

  if (errorStatus === 403) {
    return (
      <Card>
        <EmptyState
          icon={Lock}
          heading="Rate your own sketch first"
          body="Upload your sketch for this question and rate it yourself to see classmates' work."
          actionLabel="Community challenges"
          actionHref="/practice/sketches"
        />
      </Card>
    );
  }
  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !work) return <LoadingPanel />;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={work.isMine ? "Your sketch" : `${work.ownerName}'s sketch`}
        trail={[
          { label: "Practice", href: "/practice" },
          { label: "Community challenges", href: "/practice/sketches" },
        ]}
      />
      <Card>
        <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-800 dark:text-white/90">
          {work.questionText}
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          {work.maxMarks} marks
          {work.rubricTitle ? ` · rated on ${work.rubricTitle}` : ""}
        </p>
      </Card>
      <Card>
        <SketchWorkPanel work={work} questionId={work.questionId} onChange={setWork} />
      </Card>
      <p className="text-sm">
        <Link href="/practice/sketches" className="font-medium text-primary-600 hover:underline">
          ← Back to Community challenges
        </Link>
      </p>
    </main>
  );
}

export default function SketchWorkPage() {
  return (
    <RequireAuth>
      <WorkContent />
    </RequireAuth>
  );
}
