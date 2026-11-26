"use client";

import * as React from "react";
import { Brush, CheckCircle2 } from "lucide-react";
import type { SketchVersionView, SketchWorkspace, SketchWorkspaceQuestion } from "@examora/types";
import { Button, cn } from "@examora/ui";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { RevisionUpload } from "@/components/student/revision-upload";
import { SketchCommunity } from "@/components/student/sketch-community";
import { SketchPaperProvider } from "@/components/student/sketch-paper";
import { SketchWorkPanel } from "@/components/student/sketch-work";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { useStudentApi } from "@/lib/student-api";

const original = (q: SketchWorkspaceQuestion): SketchVersionView | undefined =>
  q.work?.versions.find((v) => v.kind === "TEST") ?? q.work?.versions[0];
const latest = (q: SketchWorkspaceQuestion): SketchVersionView | undefined =>
  q.work?.versions[q.work.versions.length - 1];

type Status = { label: string; tone: "neutral" | "warning" | "primary" | "success" };

function statusOf(q: SketchWorkspaceQuestion): Status {
  const o = original(q);
  if (!o) return { label: "Not uploaded", tone: "neutral" };
  if (!o.ratings.self) return { label: "Evaluate yourself", tone: "warning" };
  if (!o.ratings.expert) return { label: "Waiting for expert", tone: "primary" };
  return { label: "Reviewed", tone: "success" };
}

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "–" : n);

/** Part B's own report: each sketch's ratings and the Part B score from expert marks. */
function PartBReport({ ws, onOpen }: { ws: SketchWorkspace; onOpen: (index: number) => void }) {
  const total = ws.questions.reduce((t, q) => t + q.marks, 0);
  const reviewed = ws.questions.filter((q) => original(q)?.ratings.expert);
  const scored = reviewed.reduce((t, q) => t + (original(q)?.ratings.expert?.total ?? 0), 0);
  const uploaded = ws.questions.filter((q) => original(q)).length;
  const headId = React.useId();

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headId} className="text-base font-medium text-neutral-800 dark:text-white/90">
            Part B report
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Marked separately from Part A. The score uses the expert&rsquo;s marks on each original;
            revisions are for learning.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-neutral-800 dark:text-white/90">
            {reviewed.length ? Math.round(scored * 10) / 10 : "–"}{" "}
            <span className="text-base font-normal text-neutral-500">/ {total}</span>
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {uploaded === 0
              ? "Nothing uploaded yet"
              : reviewed.length === ws.questions.length
                ? "All sketches reviewed"
                : `${reviewed.length} of ${ws.questions.length} reviewed so far`}
          </p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table aria-labelledby={headId} className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
              <th scope="col" className="py-2 pr-3 font-medium">
                Question
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Uploads
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Self
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Expert
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Community
              </th>
              <th scope="col" className="py-2 pl-3 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {ws.questions.map((q, i) => {
              const o = original(q);
              const l = latest(q);
              const s = statusOf(q);
              return (
                <tr
                  key={q.questionId}
                  className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/60"
                >
                  <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                    <button
                      type="button"
                      onClick={() => onOpen(i)}
                      className="font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400"
                    >
                      Question {i + 1}
                    </button>
                    <span className="block text-xs text-neutral-500">
                      {q.rubricTitle ?? "Sketch"} · {q.marks} marks
                    </span>
                  </th>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {q.work?.versions.length ?? 0}/{ws.maxVersions}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmt(o?.ratings.self?.total)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {fmt(o?.ratings.expert?.total)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {l && l.ratings.community.count
                      ? `${l.ratings.community.total} (${l.ratings.community.count})`
                      : "–"}
                  </td>
                  <td className="py-2.5 pl-3">
                    <Chip tone={s.tone}>{s.label}</Chip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Self, expert and community scores are for the original, out of each question&rsquo;s marks.
        Community is the latest version, with the number of classmates who rated it.
      </p>
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
          {xp > 0 ? `Nice work! +${xp} XP for evaluating yourself` : "Self-evaluation saved"}
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Classmates&rsquo; sketches are now open. Rate at least 3 of them: +25 XP for each.
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
  index,
  maxVersions,
  onWork,
}: {
  q: SketchWorkspaceQuestion;
  index: number;
  maxVersions: number;
  onWork: (q: SketchWorkspaceQuestion) => void;
}) {
  const [prompt, setPrompt] = React.useState<number | null>(null);
  const [communityKey, setCommunityKey] = React.useState(0);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Question {index + 1} · {q.marks} marks
        </p>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-800 dark:text-white/90">
          {q.text}
        </p>
        {q.factors.length ? (
          <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
            <h3 className="text-sm font-medium text-neutral-800 dark:text-white/90">
              Evaluation criteria
              {q.rubricTitle ? (
                <span className="font-normal text-neutral-500">
                  {" "}
                  · {q.rubricTitle}, {q.factors.length} factors
                </span>
              ) : null}
            </h3>
            <ol className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {q.factors.map((f, i) => (
                <li key={f.title} className="flex gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary-300 text-[11px] font-semibold text-primary-700 dark:border-primary-500/40 dark:text-primary-300"
                  >
                    {i + 1}
                  </span>
                  <span>
                    <span className="text-neutral-800 dark:text-white/90">{f.title}</span>
                    {f.description ? (
                      <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                        {f.description}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </Card>

      <Card>
        {q.work ? (
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
            <h3 className="text-sm font-medium text-neutral-800 dark:text-white/90">
              Upload your sketch
            </h3>
            <ul className="flex flex-col gap-1 text-xs text-neutral-600 dark:text-neutral-400">
              {[
                "Draw on paper in pencil, photograph it in good light and upload it. No timer.",
                `Your first upload is your original. After it you can add revisions, up to ${maxVersions} uploads in all.`,
                "Then evaluate yourself on the factors above (+10 XP) to open classmates' sketches.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-1.5">
                  <CheckCircle2
                    size={13}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-success-600"
                  />
                  {t}
                </li>
              ))}
            </ul>
            <RevisionUpload
              questionId={q.questionId}
              remaining={maxVersions}
              onSaved={(work) => onWork({ ...q, work, canUpload: work.canUpload })}
            />
          </div>
        ) : (
          <EmptyState icon={Brush} heading="Uploads aren't open for this question" />
        )}
      </Card>

      <Card>
        <SketchCommunity questionId={q.questionId} refreshKey={communityKey} />
      </Card>

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

/**
 * Part B of a practice paper: sketching, untimed and marked separately from
 * the Part A test. Each question has its own upload (original + revisions),
 * self-evaluation, expert and community ratings, and classmates' sketches.
 */
export function PartBSketching({ quizId }: { quizId: string }) {
  const api = useStudentApi();
  const { data, errorStatus, loading, reload } = useLoad(
    () => api.sketchWorkspace(quizId),
    `part-b-${quizId}`,
  );
  const [ws, setWs] = React.useState<SketchWorkspace | null>(null);
  const [active, setActive] = React.useState(0);
  React.useEffect(() => setWs(data), [data]);
  const tabsId = React.useId();

  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !ws) return <LoadingPanel />;
  if (ws.questions.length === 0) {
    return (
      <Card>
        <EmptyState icon={Brush} heading="This paper has no sketching questions" />
      </Card>
    );
  }
  const index = Math.min(active, ws.questions.length - 1);
  const q = ws.questions[index]!;

  function open(i: number) {
    setActive(i);
    document.getElementById(`${tabsId}-tabs`)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <SketchPaperProvider value={quizId}>
      <div className="flex flex-col gap-6">
        <PartBReport ws={ws} onOpen={open} />
        <div
          id={`${tabsId}-tabs`}
          role="tablist"
          aria-label="Sketch questions"
          className="flex scroll-mt-24 flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800"
        >
          {ws.questions.map((x, i) => {
            const s = statusOf(x);
            return (
              <button
                key={x.questionId}
                id={`${tabsId}-${i}`}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-controls={`${tabsId}-panel`}
                onClick={() => setActive(i)}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                  i === index
                    ? "border-primary-600 text-primary-700 dark:text-primary-300"
                    : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400",
                )}
              >
                Question {i + 1}
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-2 w-2 rounded-full",
                    s.tone === "success"
                      ? "bg-success-500"
                      : s.tone === "primary"
                        ? "bg-primary-500"
                        : s.tone === "warning"
                          ? "bg-warning-500"
                          : "bg-neutral-300 dark:bg-neutral-600",
                  )}
                />
                <span className="sr-only">({s.label})</span>
              </button>
            );
          })}
        </div>
        <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${index}`}>
          <QuestionPanel
            key={q.questionId}
            q={q}
            index={index}
            maxVersions={ws.maxVersions}
            onWork={(next) =>
              setWs((w) =>
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
      </div>
    </SketchPaperProvider>
  );
}
