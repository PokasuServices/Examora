"use client";

import * as React from "react";
import { X } from "lucide-react";
import { ApiError } from "@examora/auth-client";
import type { Topic } from "@examora/types";
import { useContentApi } from "@/lib/content-api";

const SUGGESTED = ["NID", "UCEED", "NATA", "NIFT", "CEED", "JEE B.ARCH"];

/**
 * Exam tags on a topic (e.g. NID, UCEED, NATA). A topic with two or more tags
 * is "shared": students see it counts for several exams.
 */
export function TopicExamTags({ topicId, initial }: { topicId: string; initial: string[] }) {
  const api = useContentApi();
  const [tags, setTags] = React.useState<string[]>(initial);
  const [draft, setDraft] = React.useState("");
  const [state, setState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const inputId = React.useId();

  async function save(next: string[]) {
    const previous = tags;
    setTags(next);
    setState("saving");
    setError(null);
    try {
      const updated = await api.updateNode<Topic>("topics", topicId, { examTags: next });
      setTags(updated.examTags ?? next);
      setState("saved");
    } catch (err) {
      setTags(previous);
      setState("error");
      setError(err instanceof ApiError ? err.message : "Couldn't save the tags");
    }
  }

  function add(raw: string) {
    const tag = raw.trim().toUpperCase();
    if (!tag || tags.includes(tag)) return;
    setDraft("");
    void save([...tags, tag]);
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      <label htmlFor={inputId} className="font-medium text-neutral-500 dark:text-neutral-400">
        Exams:
      </label>
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 font-medium text-primary-700 dark:bg-primary-500/15 dark:text-primary-300"
        >
          {t}
          <button
            type="button"
            aria-label={`Remove ${t}`}
            onClick={() => void save(tags.filter((x) => x !== t))}
            className="rounded-full hover:text-error-600"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={inputId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          }
        }}
        placeholder="Add exam, press Enter"
        maxLength={30}
        className="h-7 w-36 rounded-md border border-neutral-300 bg-white px-2 dark:border-neutral-700 dark:bg-neutral-900"
      />
      {SUGGESTED.filter((s) => !tags.includes(s)).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => add(s)}
          className="rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-neutral-500 hover:border-primary-400 hover:text-primary-700 dark:border-neutral-700"
        >
          + {s}
        </button>
      ))}
      <span aria-live="polite" className="text-neutral-500">
        {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : null}
        {tags.length >= 2 && state !== "saving" ? " · shared topic" : ""}
      </span>
      {error ? <span className="text-error-600">{error}</span> : null}
    </div>
  );
}
