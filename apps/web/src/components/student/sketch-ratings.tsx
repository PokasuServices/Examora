"use client";

import * as React from "react";
import { ApiError } from "@examora/auth-client";
import type { RubricFactor, SketchVersionView, SketchWorkView } from "@examora/types";
import { Button, FieldError, cn } from "@examora/ui";
import { Check } from "lucide-react";
import { useXp } from "@/context/XpContext";
import { useStudentApi } from "@/lib/student-api";

type Tab = "mine" | "expert" | "community";

/** 1–5 bar for one factor (number shown; colour isn't the only signal). */
function ScoreBar({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
        <span
          className="block h-full rounded-full bg-primary-600"
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
      </span>
      <span className="w-10 text-right text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
        {value}/{max}
      </span>
    </span>
  );
}

function FactorLabel({ f, n }: { f: RubricFactor; n: number }) {
  return (
    <span className="min-w-0">
      <span className="text-sm text-neutral-800 dark:text-white/90">
        {n}. {f.title}
      </span>
      {f.description ? (
        <span className="block text-xs text-neutral-500 dark:text-neutral-400">
          {f.description}
        </span>
      ) : null}
    </span>
  );
}

/** The owner's one-time 1–5 rating of a version. */
function SelfRatingForm({
  factors,
  onSave,
}: {
  factors: RubricFactor[];
  onSave: (scores: Record<string, number>) => Promise<void>;
}) {
  const [scores, setScores] = React.useState<Record<string, number>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const complete = factors.every((f) => scores[f.title] !== undefined);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Rate this version 1 (weak) to 5 (excellent) on each factor. You can rate each version once;
        it can&rsquo;t be changed after saving.
      </p>
      <ol className="flex flex-col gap-3">
        {factors.map((f, i) => (
          <li key={f.title} className="flex flex-wrap items-start justify-between gap-2">
            <FactorLabel f={f} n={i + 1} />
            <div role="radiogroup" aria-label={f.title} className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={scores[f.title] === n}
                  onClick={() => setScores((p) => ({ ...p, [f.title]: n }))}
                  className={cn(
                    "h-8 w-8 rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                    scores[f.title] === n
                      ? "bg-primary-600 text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <FieldError>{error}</FieldError>
      <div>
        <Button
          disabled={!complete || saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onSave(scores);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Couldn't save your rating");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save my rating · +10 XP"}
        </Button>
      </div>
    </div>
  );
}

/** A classmate's feedback: tick what you liked and add a comment. */
function PeerFeedbackForm({
  factors,
  onSend,
}: {
  factors: RubricFactor[];
  onSend: (liked: string[], comment: string) => Promise<void>;
}) {
  const [liked, setLiked] = React.useState<string[]>([]);
  const [comment, setComment] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ids = React.useId();
  return (
    <div className="flex flex-col gap-3">
      <fieldset>
        <legend className="text-sm font-medium text-neutral-800 dark:text-white/90">
          What did you like?{" "}
          <span className="font-normal text-neutral-500">(tick one or more)</span>
        </legend>
        <ul className="mt-2 flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {factors.map((f) => (
            <li key={f.title}>
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={liked.includes(f.title)}
                  onChange={(e) =>
                    setLiked((p) =>
                      e.target.checked ? [...p, f.title] : p.filter((x) => x !== f.title),
                    )
                  }
                />
                <FactorLabel f={f} n={factors.indexOf(f) + 1} />
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${ids}-c`} className="text-sm text-neutral-700 dark:text-neutral-300">
          Comment (optional)
        </label>
        <textarea
          id={`${ids}-c`}
          rows={3}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What works, and one thing to try next"
          className="w-full rounded-md border border-neutral-300 bg-white p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
      <FieldError>{error}</FieldError>
      <div>
        <Button
          disabled={(liked.length === 0 && !comment.trim()) || saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onSend(liked, comment);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Couldn't send your feedback");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Sending…" : "Submit feedback · +25 XP"}
        </Button>
        <p className="mt-1 text-xs text-neutral-500">
          XP when you tick at least one factor, for up to 10 feedbacks a day.
        </p>
      </div>
    </div>
  );
}

/**
 * Ratings for one version: self (owner, once, 1–5), expert (reviewers) and
 * community (classmates' liked factors), each totalled out of the marks.
 */
export function SketchRatingsPanel({
  work,
  version,
  onWork,
  onSelfRated,
}: {
  work: SketchWorkView;
  version: SketchVersionView;
  onWork: (w: SketchWorkView) => void;
  onSelfRated?: (xp: number) => void;
}) {
  const api = useStudentApi();
  const { refresh: refreshXp } = useXp();
  const [tab, setTab] = React.useState<Tab>("mine");
  const [notice, setNotice] = React.useState<string | null>(null);
  const r = version.ratings;
  const max = work.maxMarks;
  const tabsId = React.useId();
  const tabs: { key: Tab; label: string }[] = [
    { key: "mine", label: work.isMine ? "My rating" : "Your feedback" },
    { key: "expert", label: `Expert${r.expert ? ` (${r.expert.count})` : ""}` },
    { key: "community", label: `Community (${r.community.count})` },
  ];

  return (
    <section
      aria-label="Ratings"
      className="rounded-md border border-neutral-200 dark:border-neutral-800"
    >
      <dl className="grid grid-cols-3 divide-x divide-neutral-200 border-b border-neutral-200 text-center dark:divide-neutral-800 dark:border-neutral-800">
        {[
          ["Self rating", r.self?.total],
          ["Expert (avg)", r.expert?.total],
          ["Community (avg)", r.community.count ? r.community.total : undefined],
        ].map(([label, value]) => (
          <div key={label as string} className="px-2 py-3">
            <dd className="text-lg font-semibold tabular-nums text-neutral-800 dark:text-white/90">
              {value === undefined || value === null ? "–" : value} / {max}
            </dd>
            <dt className="text-xs text-neutral-500">{label}</dt>
          </div>
        ))}
      </dl>
      <div
        role="tablist"
        aria-label="Rating views"
        className="flex gap-1 border-b border-neutral-200 px-2 pt-2 dark:border-neutral-800"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            id={`${tabsId}-${t.key}`}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`${tabsId}-panel`}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
              tab === t.key
                ? "border-primary-600 text-primary-700 dark:text-primary-300"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        id={`${tabsId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-${tab}`}
        className="p-4"
      >
        {tab === "mine" ? (
          work.isMine ? (
            r.self ? (
              <ol className="flex flex-col gap-2">
                {work.factors.map((f, i) => (
                  <li key={f.title} className="flex flex-wrap items-center justify-between gap-2">
                    <FactorLabel f={f} n={i + 1} />
                    <ScoreBar value={r.self!.scores[f.title] ?? 0} />
                  </li>
                ))}
              </ol>
            ) : (
              <SelfRatingForm
                factors={work.factors}
                onSave={async (scores) => {
                  const res = await api.rateVersionSelf(version.id, scores);
                  onWork(res.work);
                  if (res.xpAwarded > 0) void refreshXp();
                  onSelfRated?.(res.xpAwarded);
                }}
              />
            )
          ) : r.myFeedback ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="flex items-center gap-1.5 text-success-700 dark:text-success-400">
                <Check size={16} aria-hidden="true" /> You gave feedback on this version.
              </p>
              <p className="text-neutral-700 dark:text-neutral-300">
                Liked:{" "}
                {r.myFeedback.likedFactors.length ? r.myFeedback.likedFactors.join(", ") : "—"}
              </p>
              {r.myFeedback.comment ? (
                <p className="italic text-neutral-600 dark:text-neutral-400">
                  {r.myFeedback.comment}
                </p>
              ) : null}
              {notice ? (
                <p role="status" className="text-success-600">
                  {notice}
                </p>
              ) : null}
            </div>
          ) : (
            <PeerFeedbackForm
              factors={work.factors}
              onSend={async (liked, comment) => {
                const res = await api.giveVersionFeedback(version.id, liked, comment);
                onWork(res.work);
                if (res.xpAwarded > 0) void refreshXp();
                setNotice(
                  res.xpAwarded > 0
                    ? `+${res.xpAwarded} XP. ${res.peerXpLeftToday ?? 0} more XP-earning feedbacks today.`
                    : "Thanks! (No XP: today's limit is reached, or no factor was ticked.)",
                );
              }}
            />
          )
        ) : tab === "expert" ? (
          r.expert ? (
            <div className="flex flex-col gap-3">
              <ol className="flex flex-col gap-2">
                {work.factors.map((f, i) => (
                  <li key={f.title} className="flex flex-wrap items-center justify-between gap-2">
                    <FactorLabel f={f} n={i + 1} />
                    <ScoreBar value={r.expert!.scores[f.title] ?? 0} />
                  </li>
                ))}
              </ol>
              {r.expert.comments.map((c, i) => (
                <blockquote
                  key={i}
                  className="rounded-md bg-neutral-50 px-3 py-2 text-sm dark:bg-white/[0.03]"
                >
                  <span className="italic text-neutral-700 dark:text-neutral-300">{c.body}</span>
                  <span className="mt-1 block text-xs text-neutral-500">{c.authorName}</span>
                </blockquote>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No reviewer feedback on this version yet.</p>
          )
        ) : r.community.count === 0 ? (
          <p className="text-sm text-neutral-500">No classmate feedback on this version yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <ol className="flex flex-col gap-2">
              {work.factors.map((f, i) => (
                <li key={f.title} className="flex flex-wrap items-center justify-between gap-2">
                  <FactorLabel f={f} n={i + 1} />
                  <span className="text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
                    liked by {r.community.likes[f.title] ?? 0} of {r.community.count}
                  </span>
                </li>
              ))}
            </ol>
            {r.community.comments.map((c, i) => (
              <blockquote
                key={i}
                className="rounded-md bg-neutral-50 px-3 py-2 text-sm dark:bg-white/[0.03]"
              >
                <span className="text-neutral-700 dark:text-neutral-300">{c.body}</span>
                <span className="mt-1 block text-xs text-neutral-500">
                  {c.authorName}
                  {c.likedFactors.length ? ` · liked ${c.likedFactors.join(", ")}` : ""}
                </span>
              </blockquote>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
