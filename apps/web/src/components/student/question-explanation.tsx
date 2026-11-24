import Markdown from "react-markdown";
import { ExternalLink } from "lucide-react";
import type { QuestionResource } from "@examora/types";
import { markdownComponents } from "@/components/lesson-viewer/lesson-content";
import { mediaUrl, studyUrlTransform } from "@/lib/media";
import { StudyImage } from "./study-image";
import { VideoPlayer } from "./video-player";

/**
 * A question's explanation after submit: markdown text (may embed uploaded
 * images), an optional figure, a video solution and "further reading" links.
 * Renders nothing when the question has none of these.
 */
export function QuestionExplanation({
  explanation,
  imageUrl,
  videoUrl,
  resources,
}: {
  explanation: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  resources: QuestionResource[];
}) {
  const video = mediaUrl(videoUrl) ?? videoUrl;
  if (!explanation && !imageUrl && !video && resources.length === 0) return null;

  return (
    <section
      aria-label="Explanation"
      className="mt-5 rounded-md bg-neutral-100 px-4 py-4 text-sm text-neutral-700 dark:bg-white/[0.04] dark:text-neutral-300"
    >
      <h3 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-white">Explanation</h3>
      {video ? (
        <div className="mb-4 max-w-2xl">
          <VideoPlayer url={video} title="Video solution" />
        </div>
      ) : null}
      {explanation ? (
        <div className="leading-relaxed">
          <Markdown components={markdownComponents} urlTransform={studyUrlTransform}>
            {explanation}
          </Markdown>
        </div>
      ) : null}
      {imageUrl ? <StudyImage src={imageUrl} alt="Explanation figure" className="mt-3" /> : null}
      {resources.length > 0 ? (
        <ul className="mt-4 space-y-1">
          {resources.map((r, i) => (
            <li key={`${r.url}-${i}`}>
              <span className="mr-1 text-xs font-semibold uppercase text-primary-700 dark:text-primary-300">
                Resource {i + 1}
              </span>
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
      ) : null}
    </section>
  );
}
