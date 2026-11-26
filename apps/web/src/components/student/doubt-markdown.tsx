"use client";

import * as React from "react";
import Markdown, { defaultUrlTransform, type Components } from "react-markdown";
import { MEDIA_SCHEME } from "@examora/types";
import { rehypePlugins, remarkPlugins } from "@/lib/markdown-plugins";
import { mediaUrl } from "@/lib/media";

/**
 * Discussion posts are Markdown written by students. react-markdown never
 * renders raw HTML; on top of that, images may only be our own uploads
 * ("media:<id>"), so a post can't pull in outside images or trackers.
 */
function urlTransform(url: string, key: string, node: { tagName?: string }): string {
  if (node.tagName === "img" && key === "src") {
    return url.startsWith(MEDIA_SCHEME) ? (mediaUrl(url) ?? "") : "";
  }
  return defaultUrlTransform(url);
}

const components: Components = {
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => (
    <p className="mb-1 mt-3 text-base font-semibold text-neutral-800 first:mt-0 dark:text-white/90">
      {children}
    </p>
  ),
  h2: ({ children }) => (
    <p className="mb-1 mt-3 text-sm font-semibold text-neutral-800 first:mt-0 dark:text-white/90">
      {children}
    </p>
  ),
  h3: ({ children }) => (
    <p className="mb-1 mt-2 text-sm font-semibold text-neutral-800 first:mt-0 dark:text-white/90">
      {children}
    </p>
  ),
  ul: ({ children }) => <ul className="my-1.5 list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal pl-5">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-neutral-300 pl-3 text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md bg-neutral-100 p-3 text-xs dark:bg-white/10">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="nofollow noopener noreferrer"
      className="text-primary-600 underline dark:text-primary-400"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-neutral-300 bg-neutral-50 px-3 py-2 font-semibold text-neutral-800 dark:border-neutral-700 dark:bg-white/[0.04] dark:text-white/90">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">{children}</td>
  ),
  del: ({ children }) => <del className="text-neutral-500">{children}</del>,
  mark: ({ children }) => (
    <mark className="rounded bg-amber-100 px-0.5 text-inherit dark:bg-amber-400/25">
      {children}
    </mark>
  ),
  u: ({ children }) => <u className="underline decoration-1 underline-offset-2">{children}</u>,
  img: ({ src, alt }) =>
    src ? (
      <img
        src={typeof src === "string" ? src : undefined}
        alt={alt || "Image in this post"}
        loading="lazy"
        className="my-2 max-h-80 max-w-full rounded-md border border-neutral-200 bg-white dark:border-neutral-700"
      />
    ) : null,
};

export function DoubtMarkdown({ body }: { body: string }) {
  return (
    <div className="break-words text-sm text-neutral-700 dark:text-neutral-300">
      <Markdown
        components={components}
        urlTransform={urlTransform}
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
      >
        {body}
      </Markdown>
    </div>
  );
}
