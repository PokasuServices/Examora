"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Flag, SkipForward } from "lucide-react";
import { Button, cn } from "@examora/ui";
import { ToneCard, toneClasses, type Tone } from "@/components/ui/tone-card";

export type QuestionState = "answered" | "skipped" | "unseen";

export interface FinishItem {
  index: number;
  state: QuestionState;
  flagged: boolean;
  sectionTitle: string | null;
  /** False when the question can't be opened any more (closed or later timed section). */
  reachable: boolean;
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * "Finish the test?" summary: how many questions are answered, skipped, not
 * yet opened and flagged (overall and per section), with a jump back to any
 * of them, then Review answers or Submit.
 */
export function FinishSummaryDialog({
  open,
  items,
  remainingSeconds,
  submitting,
  error = null,
  onJump,
  onSubmit,
  onClose,
}: {
  open: boolean;
  items: FinishItem[];
  remainingSeconds: number | null;
  submitting: boolean;
  error?: string | null;
  /** Close the dialog and open this question. */
  onJump: (index: number) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const reviewRef = React.useRef<HTMLButtonElement>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    reviewRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])");
        const first = f[0];
        const last = f[f.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  if (!open) return null;

  const count = (pick: (i: FinishItem) => boolean) => items.filter(pick).length;
  const firstOf = (pick: (i: FinishItem) => boolean) =>
    items.find((i) => i.reachable && pick(i))?.index ?? null;

  const answered = count((i) => i.state === "answered");
  const skipped = count((i) => i.state === "skipped");
  const unseen = count((i) => i.state === "unseen");
  const flagged = count((i) => i.flagged);
  const open_ = skipped + unseen;

  const tiles: {
    label: string;
    hint: string;
    value: number;
    tone: Tone;
    icon: typeof Flag;
    jump: number | null;
  }[] = [
    {
      label: "Answered",
      hint: "with how you got it",
      value: answered,
      tone: "emerald",
      icon: CheckCircle2,
      jump: firstOf((i) => i.state === "answered"),
    },
    {
      label: "Skipped",
      hint: "opened, no answer",
      value: skipped,
      tone: "amber",
      icon: SkipForward,
      jump: firstOf((i) => i.state === "skipped"),
    },
    {
      label: "Not visited",
      hint: "never opened",
      value: unseen,
      tone: "slate",
      icon: CircleDashed,
      jump: firstOf((i) => i.state === "unseen"),
    },
    {
      label: "Flagged",
      hint: "marked to review",
      value: flagged,
      tone: "violet",
      icon: Flag,
      jump: firstOf((i) => i.flagged),
    },
  ];

  const sections = [...new Set(items.map((i) => i.sectionTitle).filter(Boolean))] as string[];
  // Where "Review answers" goes: flagged first, then skipped, then not visited.
  const reviewTarget =
    firstOf((i) => i.flagged) ??
    firstOf((i) => i.state === "skipped") ??
    firstOf((i) => i.state === "unseen");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-neutral-900/50"
        onClick={submitting ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-card border border-neutral-200 bg-white p-6 shadow-soft-hover motion-safe:animate-fade-up dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-neutral-900 dark:text-white">
              Finish the test?
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
              Here&rsquo;s where you stand. Click a box to go to those questions.
            </p>
          </div>
          {remainingSeconds !== null ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1 text-sm font-medium tabular-nums text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200">
              <Clock size={14} aria-hidden="true" /> {formatClock(remainingSeconds)} left
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t, i) => {
            const Icon = t.icon;
            const canJump = t.jump !== null && t.value > 0;
            return (
              <ToneCard key={t.label} tone={t.tone} index={i} interactive={canJump} className="p-0">
                <button
                  type="button"
                  disabled={!canJump}
                  onClick={() => t.jump !== null && onJump(t.jump)}
                  aria-label={`${t.label}: ${t.value}${canJump ? ". Go to the first one" : ""}`}
                  className="flex w-full flex-col items-start gap-1 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-default"
                >
                  <Icon size={16} aria-hidden="true" className={toneClasses(t.tone).text} />
                  <span className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-white">
                    {t.value}
                  </span>
                  <span className={cn("text-xs font-medium", toneClasses(t.tone).text)}>
                    {t.label}
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {t.hint}
                  </span>
                </button>
              </ToneCard>
            );
          })}
        </div>

        {sections.length > 1 ? (
          <table className="mt-4 w-full text-sm">
            <caption className="mb-1 text-left text-xs font-medium text-neutral-500">
              By section
            </caption>
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th scope="col" className="py-1 font-medium">
                  Section
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Answered
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Skipped
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Not visited
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {sections.map((s) => {
                const inS = items.filter((i) => i.sectionTitle === s);
                return (
                  <tr key={s}>
                    <th
                      scope="row"
                      className="py-1.5 text-left font-normal text-neutral-700 dark:text-neutral-300"
                    >
                      {s}
                    </th>
                    <td className="py-1.5 text-right tabular-nums">
                      {inS.filter((i) => i.state === "answered").length}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {inS.filter((i) => i.state === "skipped").length}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {inS.filter((i) => i.state === "unseen").length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}

        <div
          className={cn(
            "mt-4 flex items-start gap-2 rounded-md px-3 py-2 text-sm",
            open_ > 0
              ? "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
              : "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
          )}
        >
          {open_ > 0 ? (
            <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          ) : (
            <CheckCircle2 size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          )}
          <span>
            {open_ > 0
              ? `${open_} ${open_ === 1 ? "question has" : "questions have"} no answer. `
              : "Every question is answered. "}
            You can&rsquo;t change answers after submitting.
          </span>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={reviewRef}
            variant="outline"
            disabled={submitting}
            onClick={() => (reviewTarget !== null ? onJump(reviewTarget) : onClose())}
          >
            Review answers
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit test"}
          </Button>
        </div>
      </div>
    </div>
  );
}
