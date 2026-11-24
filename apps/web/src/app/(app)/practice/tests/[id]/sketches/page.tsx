"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Brush, Info, Lock } from "lucide-react";
import type { SketchWorkspace, SketchWorkspaceQuestion } from "@examora/types";
import { Button, cn } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { RevisionUpload } from "@/components/student/revision-upload";
import { SketchCommunity } from "@/components/student/sketch-community";
import { SketchWorkPanel } from "@/components/student/sketch-work";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBadge } from "@/components/ui/icon-badge";
import { PageHeader } from "@/components/ui/page-header";
import { useStudentApi } from "@/lib/student-api";

/** The question's rating factors, each with what it means. */
function FactorsCard({ q }: { q: SketchWorkspaceQuestion }) {
  if (q.factors.length === 0) return null;
  return (
    <Card density="compact">
      <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">
        {q.rubricTitle ? `${q.rubricTitle}: ` : ""}
        {q.factors.length} rating factors
      </h2>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Reviewers and classmates rate your sketch on these.
      </p>
      <ol className="mt-3 flex flex-col gap-2">
        {q.factors.map((f, i) => (
          <li key={f.title} className="flex gap-2 text-sm">
            <span
              aria-hidden="true"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary-300 text-[11px] font-semibold text-primary-700 dark:border-primary-500/40 dark:text-primary-300"
            >
              {i + 1}
            </span>
            <span>
              <span className="font-medium text-neutral-800 dark:text-white/90">{f.title}</span>
              {f.description ? (
                <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                  {f.description}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** After rating your own sketch: nudge to rate classmates. */
function RatePeersPrompt({
  xp,
  onGo,
  onLater,
}: {
  xp: number;
  onGo: () => void;
  onLater: () => void;
}) {
  const goRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => goRef.current?.focus(), []);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onLater();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onLater]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/40" onClick={onLater} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-peers-title"
        className="relative w-full max-w-md rounded-card border border-neutral-200 bg-white p-6 text-center shadow-soft-hover dark:border-neutral-800 dark:bg-neutral-900"
      >
        <h2
          id="rate-peers-title"
          className="text-lg font-medium text-neutral-800 dark:text-white/90"
        >
          {xp > 0 ? `Nice work! +${xp} XP for rating yourself` : "Rating saved"}
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          The best way to learn is to help others learn. Rate at least 3 classmates&rsquo; sketches:
          +25 XP for each.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button ref={goRef} onClick={onGo}>
            Rate classmates
          </Button>
          <Button variant="ghost" onClick={onLater}>
            Maybe later
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuestionPanel({
  q,
  finished,
  onWork,
}: {
  q: SketchWorkspaceQuestion;
  finished: boolean;
  onWork: (q: SketchWorkspaceQuestion) => void;
}) {
  const [prompt, setPrompt] = React.useState<number | null>(null);
  const [communityKey, setCommunityKey] = React.useState(0);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            {q.sectionTitle ? (
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {q.sectionTitle}
              </p>
            ) : null}
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-neutral-800 dark:text-white/90">
              {q.text}
            </p>
            <p className="mt-2 text-xs text-neutral-500">{q.marks} marks in the test</p>
          </Card>
          <Card>
            {!finished ? (
              <EmptyState
                icon={Lock}
                heading="Finish the test first"
                body="The sketch you upload during the test is your test answer. After the test you can upload revised versions here."
              />
            ) : q.work ? (
              <SketchWorkPanel
                work={q.work}
                questionId={q.questionId}
                onChange={(work) => onWork({ ...q, work, canUpload: work.canUpload })}
                onSelfRated={(xp) => {
                  setCommunityKey((k) => k + 1);
                  setPrompt(xp);
                }}
              />
            ) : q.canUpload ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  You didn&rsquo;t upload a sketch for this question during the test. Practise it
                  here: it won&rsquo;t change your test score.
                </p>
                <RevisionUpload
                  questionId={q.questionId}
                  remaining={4}
                  onSaved={(work) => onWork({ ...q, work, canUpload: work.canUpload })}
                />
              </div>
            ) : null}
          </Card>
        </div>
        <aside className="flex flex-col gap-4">
          <FactorsCard q={q} />
          <Card density="compact" className="flex gap-3">
            <IconBadge icon={Info} tone="primary" />
            <ul className="flex flex-col gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
              <li>Upload up to 4 versions in total, including your test upload.</li>
              <li>Your test score uses the reviewer&rsquo;s marks on the test upload only.</li>
              <li>Click a spot on the image to leave a comment exactly there.</li>
              <li>
                Rate each version yourself once (+10 XP) to unlock classmates&rsquo; sketches.
              </li>
            </ul>
          </Card>
        </aside>
      </div>
      {finished ? (
        <Card>
          <SketchCommunity questionId={q.questionId} refreshKey={communityKey} />
        </Card>
      ) : null}
      {prompt !== null ? (
        <RatePeersPrompt
          xp={prompt}
          onLater={() => setPrompt(null)}
          onGo={() => {
            setPrompt(null);
            document
              .getElementById(`community-${q.questionId}`)
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      ) : null}
    </div>
  );
}

function WorkspaceContent() {
  const { id } = useParams<{ id: string }>();
  const api = useStudentApi();
  const { data, errorStatus, loading, reload } = useLoad(() => api.sketchWorkspace(id), id);
  const [workspace, setWorkspace] = React.useState<SketchWorkspace | null>(null);
  const [active, setActive] = React.useState(0);
  React.useEffect(() => setWorkspace(data), [data]);
  const tabsId = React.useId();

  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !workspace) return <LoadingPanel />;
  const questions = workspace.questions;
  const q = questions[Math.min(active, questions.length - 1)];

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Sketch workspace"
        subtitle={workspace.quiz.title}
        trail={[
          { label: "Practice", href: "/practice" },
          { label: workspace.quiz.title, href: `/practice/tests/${workspace.quiz.id}` },
        ]}
        actions={
          <Link
            href="/practice/sketches"
            className="inline-flex h-10 items-center rounded-md border border-neutral-300 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-white/5"
          >
            Community challenges
          </Link>
        }
      />
      {questions.length === 0 ? (
        <Card>
          <EmptyState icon={Brush} heading="This test has no sketch questions" />
        </Card>
      ) : (
        <>
          {questions.length > 1 ? (
            <div
              role="tablist"
              aria-label="Sketch questions"
              className="flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800"
            >
              {questions.map((x, i) => (
                <button
                  key={x.questionId}
                  id={`${tabsId}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-controls={`${tabsId}-panel`}
                  onClick={() => setActive(i)}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                    i === active
                      ? "border-primary-600 text-primary-700 dark:text-primary-300"
                      : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400",
                  )}
                >
                  Question {i + 1}
                  {x.work ? (
                    <span className="ml-1.5 text-xs text-neutral-400">
                      {x.work.versions.length}/{workspace.maxVersions}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
          {q ? (
            <div id={`${tabsId}-panel`} role={questions.length > 1 ? "tabpanel" : undefined}>
              <QuestionPanel
                key={q.questionId}
                q={q}
                finished={workspace.finished}
                onWork={(next) =>
                  setWorkspace((w) =>
                    w
                      ? {
                          ...w,
                          questions: w.questions.map((x) =>
                            x.questionId === next.questionId ? next : x,
                          ),
                        }
                      : w,
                  )
                }
              />
            </div>
          ) : null}
          {!workspace.finished ? (
            <p className="text-sm text-neutral-500">
              <Link
                href={`/practice/tests/${workspace.quiz.id}`}
                className="font-medium text-primary-600 hover:underline"
              >
                Back to the test
              </Link>
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}

export default function SketchWorkspacePage() {
  return (
    <RequireAuth>
      <WorkspaceContent />
    </RequireAuth>
  );
}
