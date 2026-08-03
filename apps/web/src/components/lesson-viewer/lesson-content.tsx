import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import { FileText, Image as ImageIcon, PlayCircle } from "lucide-react";
import type { LessonWithProgress } from "@examora/types";

// Schema comment on Lesson.body: "Rich-text/markdown body for TEXT/ARTICLE
// lessons." No admin editor in this platform is a WYSIWYG — lesson content
// is authored as plain text in a <textarea> (apps/admin/src/app/content/
// courses/[id]/page.tsx) — but the field's own documented format is
// markdown, so rendering it as markdown is honoring the real schema
// contract, not inventing structure. Plain text with no markdown syntax
// renders identically to itself either way.
const markdownComponents: Components = {
  h1: ({ children }) => (
    <h2 className="mt-8 font-heading text-xl font-bold text-neutral-900 first:mt-0">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="mt-6 font-heading text-lg font-semibold text-neutral-900">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-5 font-heading text-base font-semibold text-neutral-900">{children}</h4>
  ),
  p: ({ children }) => <p className="mt-4 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-4 list-disc space-y-1.5 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="mt-4 list-decimal space-y-1.5 pl-6">{children}</ol>,
  li: ({ children }) => <li className="text-neutral-700">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary-600 underline decoration-primary-200 underline-offset-2 hover:decoration-primary-500"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-neutral-900">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-2 border-primary-200 pl-4 text-neutral-600 italic">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[0.875em] text-neutral-800">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mt-4 overflow-x-auto rounded-md bg-neutral-900 p-4 text-sm text-neutral-100">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-6 border-neutral-100" />,
  img: ({ src, alt }) => (
    // Plain <img>, not next/image — lesson image URLs are arbitrary external hosts, not part of any configured image domain allowlist.
    <img src={src} alt={alt ?? ""} className="mt-4 rounded-md border border-neutral-100" />
  ),
};

const MEDIA_LABEL: Record<"VIDEO" | "PDF" | "IMAGE", { icon: typeof PlayCircle; label: string }> = {
  VIDEO: { icon: PlayCircle, label: "Open video" },
  PDF: { icon: FileText, label: "Open PDF" },
  IMAGE: { icon: ImageIcon, label: "Open image" },
};

/** The reading area — markdown prose for TEXT/ARTICLE, a link-out panel for hosted media types. */
export function LessonContent({ lesson }: { lesson: LessonWithProgress }) {
  if (lesson.contentType === "TEXT" || lesson.contentType === "ARTICLE") {
    return (
      <div className="max-w-none text-base leading-relaxed text-neutral-700 sm:text-lg sm:leading-relaxed">
        {lesson.body ? (
          <Markdown components={markdownComponents}>{lesson.body}</Markdown>
        ) : (
          <p className="text-neutral-400">No content has been added to this lesson yet.</p>
        )}
      </div>
    );
  }

  if (lesson.contentUrl) {
    const media = MEDIA_LABEL[lesson.contentType];
    const Icon = media.icon;
    return (
      <a
        href={lesson.contentUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-card border border-neutral-900/[0.06] bg-neutral-50 p-6 text-primary-700 shadow-soft transition-colors hover:bg-primary-50"
      >
        <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
        <span className="text-sm font-medium">{media.label} ↗</span>
      </a>
    );
  }

  return <p className="text-neutral-400">No content is available for this lesson yet.</p>;
}
