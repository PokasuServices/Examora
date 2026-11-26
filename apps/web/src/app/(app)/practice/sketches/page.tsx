"use client";

import * as React from "react";
import Link from "next/link";
import { Brush, ChevronDown, Lock } from "lucide-react";
import type { SketchChallenge } from "@examora/types";
import { cn } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { SketchCommunity } from "@/components/student/sketch-community";
import { SketchPaperProvider } from "@/components/student/sketch-paper";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useStudentApi } from "@/lib/student-api";

function ChallengeCard({ c }: { c: SketchChallenge }) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-neutral-500">
            {c.courseTitle} · {c.test.title}
          </p>
          <p className="mt-1 line-clamp-3 text-sm text-neutral-800 dark:text-white/90">{c.text}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip tone="neutral">
              {c.uploads} {c.uploads === 1 ? "sketch" : "sketches"} shared
            </Chip>
            {c.myWorkId ? (
              <Chip tone="primary">You: {c.myVersions} of 4 uploads</Chip>
            ) : (
              <Chip tone="warning">Not uploaded yet</Chip>
            )}
          </div>
        </div>
        <Link
          href={`/practice/tests/${c.test.id}?part=b`}
          className="inline-flex h-9 shrink-0 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          {c.myWorkId ? "Open in Part B" : "Upload in Part B"}
        </Link>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 self-start rounded text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400"
      >
        {c.unlocked ? null : <Lock size={14} aria-hidden="true" />}
        {open ? "Hide classmates' sketches" : "See classmates' sketches"}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div id={panelId} className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <SketchPaperProvider value={c.test.id}>
            <SketchCommunity questionId={c.questionId} />
          </SketchPaperProvider>
        </div>
      ) : null}
    </Card>
  );
}

/** Every sketch question you can practise, with how many classmates have shared theirs. */
function ChallengesContent() {
  const api = useStudentApi();
  const { data, errorStatus, loading, reload } = useLoad(
    () => api.sketchChallenges(),
    "challenges",
  );
  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !data) return <LoadingPanel />;
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Community challenges"
        subtitle="Sketch questions from your practice tests. Upload yours, rate it, then learn from classmates' versions."
        trail={[{ label: "Practice", href: "/practice" }]}
      />
      {data.length === 0 ? (
        <Card>
          <EmptyState
            icon={Brush}
            heading="No sketch questions yet"
            body="Sketch questions in your practice tests appear here."
          />
        </Card>
      ) : (
        data.map((c) => <ChallengeCard key={c.questionId} c={c} />)
      )}
    </main>
  );
}

export default function CommunityChallengesPage() {
  return (
    <RequireAuth>
      <ChallengesContent />
    </RequireAuth>
  );
}
