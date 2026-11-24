"use client";

import * as React from "react";
import { Brush, MessageSquarePlus, Star } from "lucide-react";
import type { SketchGalleryItem, SketchView } from "@examora/types";
import { Button, cn } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { ErrorPanel, LoadingPanel } from "@/components/student/load-panels";
import { SketchPinsDialog } from "@/components/student/sketch-pins";
import { StudyImage } from "@/components/student/study-image";
import { useLoad } from "@/components/student/use-load";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useStudentApi } from "@/lib/student-api";

function ScorePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={cn(
              "h-8 w-8 rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
              value === n
                ? "bg-primary-600 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Opens a sketch with its pinned comments. */
function PinsButton({
  answerId,
  imageRef,
  title,
  imageAlt,
  label = "Comments",
}: {
  answerId: string;
  imageRef: string;
  title: string;
  imageAlt: string;
  label?: string;
}) {
  const api = useStudentApi();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <MessageSquarePlus size={14} aria-hidden="true" className="mr-1.5" />
        {label}
      </Button>
      {open ? (
        <SketchPinsDialog
          title={title}
          imageRef={imageRef}
          imageAlt={imageAlt}
          load={() => api.sketchComments(answerId)}
          add={(c) => api.addSketchComment(answerId, c)}
          remove={(id) => api.deleteSketchComment(id)}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function Gallery({ questionId }: { questionId: string }) {
  const api = useStudentApi();
  const { data, errorStatus, reload } = useLoad(() => api.gallery(questionId), questionId);
  if (errorStatus !== null)
    return <p className="text-sm text-danger-600">Couldn&rsquo;t load the gallery.</p>;
  if (!data) return <p className="text-sm text-neutral-500">Loading others&rsquo; sketches…</p>;
  if (data.length === 0)
    return (
      <p className="text-sm text-neutral-500">
        No one else has shared a sketch for this question yet.
      </p>
    );
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((g: SketchGalleryItem) => (
        <li
          key={g.answerId}
          className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
        >
          <StudyImage
            src={g.imageRef}
            alt={`Sketch by ${g.authorName}`}
            className="max-h-48 w-full"
          />
          <p className="mt-2 text-sm font-medium text-neutral-800 dark:text-white/90">
            {g.authorName}
          </p>
          <p className="text-xs text-neutral-500">
            {g.peerAverage === null ? "No ratings yet" : `★ ${g.peerAverage} from ${g.peerCount}`}
          </p>
          <div className="mt-2">
            <PinsButton
              answerId={g.answerId}
              imageRef={g.imageRef}
              title={`Sketch by ${g.authorName}`}
              imageAlt={`Sketch by ${g.authorName}`}
              label="Comment on a spot"
            />
          </div>
          <div
            className="mt-2 flex gap-1"
            role="radiogroup"
            aria-label={`Rate ${g.authorName}'s sketch`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={g.myRating === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onClick={async () => {
                  await api.peerRate(g.answerId, n).catch(() => undefined);
                  reload();
                }}
              >
                <Star
                  size={18}
                  aria-hidden="true"
                  className={
                    n <= (g.myRating ?? 0)
                      ? "fill-warning-500 text-warning-500"
                      : "text-neutral-300"
                  }
                />
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SketchCard({
  sketch,
  onChange,
}: {
  sketch: SketchView;
  onChange: (s: SketchView) => void;
}) {
  const api = useStudentApi();
  const [scores, setScores] = React.useState<Record<string, number>>(sketch.selfScores ?? {});
  const [saving, setSaving] = React.useState(false);
  const [showGallery, setShowGallery] = React.useState(false);
  const rated = sketch.selfScores !== null;
  const complete = sketch.criteria.every((c) => scores[c] !== undefined);

  return (
    <Card>
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <div>
          <StudyImage src={sketch.imageRef} alt="Your sketch" className="w-full" />
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Image not showing? It appears once the safety scan finishes.
          </p>
          <div className="mt-3">
            <PinsButton
              answerId={sketch.answerId}
              imageRef={sketch.imageRef}
              title="Your sketch"
              imageAlt="Your sketch"
              label="Comments on spots"
            />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">{sketch.questionText}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sketch.marksAwarded !== null ? (
                <Chip tone="success">
                  Marked {sketch.marksAwarded} / {sketch.marks}
                </Chip>
              ) : (
                <Chip tone="warning">Awaiting reviewer</Chip>
              )}
              {sketch.peerAverage !== null ? (
                <Chip tone="neutral">
                  Peers ★ {sketch.peerAverage} ({sketch.peerCount})
                </Chip>
              ) : null}
            </div>
          </div>

          {sketch.expertScores ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th scope="col" className="py-1 font-medium">
                    Criterion
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    You
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Reviewer
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {sketch.criteria.map((c) => (
                  <tr key={c}>
                    <th scope="row" className="py-1.5 text-left font-normal">
                      {c}
                    </th>
                    <td className="py-1.5 text-right tabular-nums">
                      {sketch.selfScores?.[c] ?? "—"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {sketch.expertScores?.[c] ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {sketch.expertComment ? (
            <blockquote className="rounded-md bg-neutral-50 px-3 py-2 text-sm italic text-neutral-700 dark:bg-white/[0.03] dark:text-neutral-300">
              {sketch.expertComment}
            </blockquote>
          ) : null}

          {!rated ? (
            <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="text-sm font-medium text-neutral-800 dark:text-white/90">
                Rate your own sketch (1 = weak, 5 = excellent)
              </p>
              {sketch.criteria.map((c) => (
                <ScorePicker
                  key={c}
                  label={c}
                  value={scores[c]}
                  onChange={(v) => setScores((p) => ({ ...p, [c]: v }))}
                />
              ))}
              <div>
                <Button
                  size="sm"
                  disabled={!complete || saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      onChange(await api.selfRate(sketch.answerId, scores));
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Saving…" : "Save my rating"}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button variant="outline" size="sm" onClick={() => setShowGallery((s) => !s)}>
                {showGallery ? "Hide others' sketches" : "See and rate others' sketches"}
              </Button>
            </div>
          )}
        </div>
      </div>
      {rated && showGallery ? (
        <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <Gallery questionId={sketch.questionId} />
        </div>
      ) : null}
    </Card>
  );
}

function SketchesContent() {
  const api = useStudentApi();
  const { data, errorStatus, loading, reload } = useLoad(() => api.mySketches(), "my-sketches");
  const [overrides, setOverrides] = React.useState<Record<string, SketchView>>({});
  if (errorStatus !== null) return <ErrorPanel status={errorStatus} onRetry={reload} />;
  if (loading || !data) return <LoadingPanel />;
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="My sketches"
        subtitle="Drawings you uploaded in tests, with your rating, a reviewer's marks and feedback from peers."
      />
      {data.length === 0 ? (
        <Card>
          <EmptyState
            icon={Brush}
            heading="No sketches yet"
            body="Sketching questions in practice tests ask you to upload a photo of your drawing."
            actionLabel="Go to practice"
            actionHref="/practice"
          />
        </Card>
      ) : (
        data.map((s) => (
          <SketchCard
            key={s.answerId}
            sketch={overrides[s.answerId] ?? s}
            onChange={(v) => setOverrides((p) => ({ ...p, [v.answerId]: v }))}
          />
        ))
      )}
    </main>
  );
}

export default function SketchesPage() {
  return (
    <RequireAuth>
      <SketchesContent />
    </RequireAuth>
  );
}
