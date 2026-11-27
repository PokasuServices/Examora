"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { useAuth } from "@examora/auth-client";
import type { DuplicateMatch } from "@examora/types";
import { useDeskApi } from "@/lib/desk-api";

/**
 * Warns (never blocks) while a question is typed if a similar one already
 * exists in the course: "A similar question already exists: Mock 2, Q14 (92%)".
 */
export function DuplicateHint({
  text,
  imageUrl,
  excludeId,
}: {
  text: string;
  imageUrl?: string | null;
  excludeId?: string | null;
}) {
  const api = useDeskApi();
  const { user } = useAuth();
  const [matches, setMatches] = React.useState<DuplicateMatch[]>([]);
  const [dismissed, setDismissed] = React.useState<string | null>(null);
  const enabled = user?.permissions.includes("mentor:workflow") ?? false;

  React.useEffect(() => {
    if (!enabled || (text.trim().length < 15 && !imageUrl)) {
      setMatches([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .duplicates({ text, imageUrl: imageUrl || null, excludeId: excludeId ?? null })
        .then(setMatches)
        .catch(() => setMatches([]));
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, imageUrl, excludeId, enabled]);

  const top = matches[0];
  if (!top || dismissed === top.questionId) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 motion-safe:animate-fade-up dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p>
          A similar question already exists: <strong>{top.where}</strong> ({top.similarity}% match).
        </p>
        <p className="mt-0.5 truncate text-xs opacity-80">“{top.text}”</p>
        <div className="mt-1.5 flex flex-wrap gap-3 text-xs font-medium">
          <Link
            href={`/assessment/questions/${top.questionId}`}
            target="_blank"
            className="underline"
          >
            View it
          </Link>
          <Link href={`/assessment/questions/${top.questionId}`} className="underline">
            Use existing
          </Link>
          <button type="button" className="underline" onClick={() => setDismissed(top.questionId)}>
            Add anyway
          </button>
          {matches.length > 1 ? (
            <span className="opacity-70">+{matches.length - 1} more similar</span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(top.questionId)}
        className="rounded p-0.5 hover:bg-amber-100 dark:hover:bg-white/10"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
