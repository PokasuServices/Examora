"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { WeakTopicAction } from "@examora/types";
import { ToneCard } from "@/components/ui/tone-card";
import { useStudentApi } from "@/lib/student-api";

/**
 * "My actions": topics where answers the student was sure of ("I knew it")
 * turned out wrong. Each card links to the topic and can be marked studied,
 * which hides it until new mistakes appear.
 */
export function WeakTopicCards({
  topics,
  onStudied,
  currentTopicId,
}: {
  topics: WeakTopicAction[];
  onStudied: (id: string) => void;
  /** On a topic page, that topic's card says "You're here" instead of linking. */
  currentTopicId?: string;
}) {
  const api = useStudentApi();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {topics.map((t, i) => (
        <li key={t.topicId} className="flex">
          <ToneCard tone="rose" index={i} className="flex w-full flex-col p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-800 dark:text-white/90">
                  {t.topicTitle}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.subjectTitle}</p>
              </div>
              <AlertTriangle size={16} aria-hidden="true" className="shrink-0 text-rose-500" />
            </div>
            <p className="mt-2 flex-1 text-xs text-neutral-600 dark:text-neutral-400">
              <span className="font-semibold text-rose-700 dark:text-rose-300">
                {t.wrongFromKnowledge} of {t.answered}
              </span>{" "}
              answered wrong despite knowing
            </p>
            <div className="mt-3 flex items-center gap-3 text-sm">
              {t.topicId === currentTopicId ? (
                <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
                  You&rsquo;re here
                </span>
              ) : (
                <Link
                  href={`/learn/topics/${t.topicId}`}
                  className="font-medium text-rose-700 hover:underline dark:text-rose-300"
                >
                  Revise
                </Link>
              )}
              <button
                type="button"
                disabled={busy === t.topicId}
                onClick={async () => {
                  setBusy(t.topicId);
                  setFailed(null);
                  try {
                    await api.markStudied(t.topicId, true);
                    onStudied(t.topicId);
                  } catch {
                    setFailed(t.topicId);
                  } finally {
                    setBusy(null);
                  }
                }}
                className="inline-flex items-center gap-1 text-neutral-600 hover:underline disabled:opacity-50 dark:text-neutral-400"
              >
                <CheckCircle2 size={14} aria-hidden="true" />
                {busy === t.topicId ? "Saving…" : "Mark as studied"}
              </button>
            </div>
            {failed === t.topicId ? (
              <p role="alert" className="mt-1 text-xs text-danger-600">
                Couldn&rsquo;t save. Try again.
              </p>
            ) : null}
          </ToneCard>
        </li>
      ))}
    </ul>
  );
}
