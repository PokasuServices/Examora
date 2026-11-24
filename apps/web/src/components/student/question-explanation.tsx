"use client";

import * as React from "react";
import Markdown from "react-markdown";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Images,
  Link2,
  PlayCircle,
} from "lucide-react";
import type { ExplanationStep, QuestionResource } from "@examora/types";
import { cn } from "@examora/ui";
import { markdownComponents } from "@/components/lesson-viewer/lesson-content";
import { mediaUrl, studyUrlTransform } from "@/lib/media";
import { StudyImage } from "./study-image";
import { VideoPlayer } from "./video-player";

function PartHeading({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
      <Icon size={14} aria-hidden className="text-primary-600 dark:text-primary-400" />
      {children}
    </h4>
  );
}

/** Image sequence: one step at a time, with Previous / Next and numbered steps. */
function StepImages({ steps }: { steps: ExplanationStep[] }) {
  const [index, setIndex] = React.useState(0);
  const step = steps[Math.min(index, steps.length - 1)]!;
  const go = (i: number) => setIndex(Math.max(0, Math.min(steps.length - 1, i)));

  return (
    <div
      role="group"
      aria-roledescription="image sequence"
      aria-label={`Step-by-step solution, ${steps.length} steps`}
      className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-neutral-800 dark:text-white/90" aria-live="polite">
          Step {index + 1} of {steps.length}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous step"
            className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-300 dark:hover:bg-white/5"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === steps.length - 1}
            aria-label="Next step"
            className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-300 dark:hover:bg-white/5"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="mt-2 flex min-h-40 items-center justify-center rounded bg-neutral-50 p-2 dark:bg-white/[0.03]">
        <StudyImage
          src={step.imageUrl}
          alt={step.caption ?? `Step ${index + 1}`}
          className="max-h-80"
        />
      </div>
      {step.caption ? (
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{step.caption}</p>
      ) : null}
      <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Go to step">
        {steps.map((s, i) => (
          <li key={`${s.imageUrl}-${i}`}>
            <button
              type="button"
              onClick={() => go(i)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") go(index + 1);
                if (e.key === "ArrowLeft") go(index - 1);
              }}
              aria-current={i === index ? "step" : undefined}
              aria-label={`Step ${i + 1}${s.caption ? `: ${s.caption}` : ""}`}
              className={cn(
                "h-7 min-w-7 rounded-full px-2 text-xs font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                i === index
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300",
              )}
            >
              {i + 1}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * A question's explanation after submit: video solution, written explanation
 * (markdown, may embed uploaded images), a figure, step-by-step images and
 * reference links. Renders nothing when the question has none of these.
 */
export function QuestionExplanation({
  explanation,
  imageUrl,
  videoUrl,
  steps = [],
  resources,
}: {
  explanation: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  steps?: ExplanationStep[];
  resources: QuestionResource[];
}) {
  const video = mediaUrl(videoUrl) ?? videoUrl;
  if (!explanation && !imageUrl && !video && steps.length === 0 && resources.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Explanation"
      className="mt-5 flex flex-col gap-5 rounded-md bg-neutral-100 px-4 py-4 text-sm text-neutral-700 dark:bg-white/[0.04] dark:text-neutral-300"
    >
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Explanation</h3>
      {explanation || imageUrl ? (
        <div>
          <PartHeading icon={FileText}>Solution</PartHeading>
          {explanation ? (
            <div className="leading-relaxed">
              <Markdown components={markdownComponents} urlTransform={studyUrlTransform}>
                {explanation}
              </Markdown>
            </div>
          ) : null}
          {imageUrl ? (
            <StudyImage src={imageUrl} alt="Explanation figure" className="mt-3" />
          ) : null}
        </div>
      ) : null}
      {steps.length > 0 ? (
        <div>
          <PartHeading icon={Images}>Step by step</PartHeading>
          <StepImages steps={steps} />
        </div>
      ) : null}
      {video ? (
        <div className="max-w-2xl">
          <PartHeading icon={PlayCircle}>Video solution</PartHeading>
          <VideoPlayer url={video} title="Video solution" />
        </div>
      ) : null}
      {resources.length > 0 ? (
        <div>
          <PartHeading icon={Link2}>References</PartHeading>
          <ul className="space-y-1">
            {resources.map((r, i) => (
              <li key={`${r.url}-${i}`}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary-700 underline underline-offset-2 dark:text-primary-300"
                >
                  {r.label}
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
