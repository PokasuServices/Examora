"use client";

import * as React from "react";
import {
  Flag,
  HandHeart,
  HelpCircle,
  Lightbulb,
  MessageCircle,
  MoreVertical,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { AttemptReviewQuestion, DoubtKind, QuestionDoubtView } from "@examora/types";
import { Button, cn } from "@examora/ui";
import { ToneCard } from "@/components/ui/tone-card";
import { useStudentApi } from "@/lib/student-api";
import { DoubtComposer } from "./doubt-composer";
import { DoubtMarkdown } from "./doubt-markdown";

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function initials(name: string): string {
  const parts = name.replace(/\./g, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Avatar({ name, small }: { name: string; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary-500/10 font-semibold text-primary-700 dark:text-primary-300",
        small ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs",
      )}
    >
      {initials(name)}
    </span>
  );
}

/** ⋮ menu on a post: delete your own, report someone else's. */
function PostMenu({
  post,
  onDeleted,
  onReport,
}: {
  post: { id: string; isMine: boolean; authorName: string };
  onDeleted: () => void;
  onReport: () => void;
}) {
  const api = useStudentApi();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`More actions for ${post.authorName}'s post`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="rounded p-1 text-neutral-500 hover:bg-neutral-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-white/10"
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      {open ? (
        <ul
          id={menuId}
          role="menu"
          className="absolute right-0 z-10 mt-1 w-40 rounded-md border border-neutral-200 bg-white py-1 text-sm shadow-soft-hover dark:border-neutral-700 dark:bg-neutral-900"
        >
          {post.isMine ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  setOpen(false);
                  if (!window.confirm("Delete this post?")) return;
                  await api.deleteDoubt(post.id).catch(() => undefined);
                  onDeleted();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-danger-600 hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none dark:hover:bg-white/5"
              >
                <Trash2 size={14} aria-hidden="true" /> Delete
              </button>
            </li>
          ) : (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onReport();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-neutral-700 hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none dark:text-neutral-300 dark:hover:bg-white/5"
              >
                <Flag size={14} aria-hidden="true" /> Report
              </button>
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

/** Inline "why are you reporting this?" form under a post. */
function ReportForm({ doubtId, onDone }: { doubtId: string; onDone: (sent: boolean) => void }) {
  const api = useStudentApi();
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => inputRef.current?.focus(), []);
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-700">
      <label
        htmlFor={`report-${doubtId}`}
        className="text-xs text-neutral-600 dark:text-neutral-400"
      >
        Why are you reporting this post? A moderator will review it.
      </label>
      <input
        id={`report-${doubtId}`}
        ref={inputRef}
        value={reason}
        maxLength={300}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. spam, rude, wrong working"
        className="h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900"
      />
      {failed ? <p className="text-xs text-danger-600">Couldn&rsquo;t send. Try again.</p> : null}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={busy || reason.trim().length < 3}
          onClick={async () => {
            setBusy(true);
            setFailed(false);
            try {
              await api.reportDoubt(doubtId, reason.trim());
              onDone(true);
            } catch {
              setFailed(true);
              setBusy(false);
            }
          }}
        >
          Send report
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDone(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

const KIND_CHIP: Record<DoubtKind, { label: string; icon: typeof HelpCircle; className: string }> =
  {
    DOUBT: {
      label: "Doubt",
      icon: HelpCircle,
      className: "bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-neutral-300",
    },
    EXPLANATION: {
      label: "Explanation",
      icon: Lightbulb,
      className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
    },
  };

function KindChip({ kind }: { kind: DoubtKind }) {
  const k = KIND_CHIP[kind];
  const Icon = k.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        k.className,
      )}
    >
      <Icon size={12} aria-hidden="true" /> {k.label}
    </span>
  );
}

/**
 * Discussion on a question: doubts and explanations (Markdown, images),
 * with "Helpful" claps, replies, and delete/report.
 */
export function DoubtsThread({
  questionId,
  question,
  questionIndex,
}: {
  questionId: string;
  /** Shown beside the editor when posting. */
  question?: AttemptReviewQuestion;
  questionIndex?: number;
}) {
  const api = useStudentApi();
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const [doubts, setDoubts] = React.useState<QuestionDoubtView[] | null>(null);
  const [composer, setComposer] = React.useState<DoubtKind | null>(null);
  const [replyTo, setReplyTo] = React.useState<string | null>(null);
  const [reply, setReply] = React.useState("");
  const [reportFor, setReportFor] = React.useState<string | null>(null);
  const [reportedIds, setReportedIds] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const replyRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (replyTo) replyRef.current?.focus();
  }, [replyTo]);

  const load = React.useCallback(() => {
    apiRef.current
      .doubts(questionId)
      .then(setDoubts)
      .catch(() => setDoubts([]));
  }, [questionId]);

  React.useEffect(() => {
    setDoubts(null);
    setReplyTo(null);
    setReportFor(null);
    setNotice(null);
    load();
  }, [load]);

  async function postReply(parentId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.postDoubt(questionId, reply.trim(), parentId);
      setReply("");
      setReplyTo(null);
      load();
    } catch {
      setError("Couldn't post. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function reportArea(id: string) {
    if (reportedIds.has(id)) {
      return <p className="mt-2 text-xs text-success-600">Reported. Thanks for letting us know.</p>;
    }
    if (reportFor !== id) return null;
    return (
      <ReportForm
        doubtId={id}
        onDone={(sent) => {
          setReportFor(null);
          if (sent) setReportedIds((prev) => new Set(prev).add(id));
        }}
      />
    );
  }

  return (
    <section
      aria-labelledby={`doubts-${questionId}`}
      className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3
          id={`doubts-${questionId}`}
          className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-white/90"
        >
          <MessageCircle size={16} aria-hidden="true" /> Discussion
          {doubts && doubts.length > 0 ? (
            <span className="font-normal text-neutral-500">({doubts.length})</span>
          ) : null}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setComposer("DOUBT")}>
            <HelpCircle size={16} aria-hidden="true" /> Ask a doubt
          </Button>
          <Button size="sm" onClick={() => setComposer("EXPLANATION")}>
            <Lightbulb size={16} aria-hidden="true" /> Post an explanation
          </Button>
        </div>
      </div>
      {notice ? (
        <p role="status" className="mt-3 text-sm text-success-600">
          {notice}
        </p>
      ) : null}

      {doubts === null ? (
        <p className="mt-3 text-sm text-neutral-500">Loading…</p>
      ) : doubts.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          No one has posted yet. Ask a doubt, or explain how you solved it.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {doubts.map((d, i) => (
            <li key={d.id}>
              <ToneCard
                tone={d.kind === "EXPLANATION" ? "indigo" : "slate"}
                index={Math.min(i, 6)}
                className="p-4"
              >
                <div className="flex gap-3">
                  <Avatar name={d.authorName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                        <span className="text-sm font-medium text-neutral-800 dark:text-white/90">
                          {d.authorName}
                        </span>
                        <span>{timeAgo(d.createdAt)}</span>
                        <KindChip kind={d.kind} />
                        {d.popular ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                            <Sparkles size={12} aria-hidden="true" /> Popular
                          </span>
                        ) : null}
                      </div>
                      <PostMenu post={d} onDeleted={load} onReport={() => setReportFor(d.id)} />
                    </div>
                    <div className="mt-1">
                      <DoubtMarkdown body={d.body} />
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs">
                      <button
                        type="button"
                        aria-pressed={d.clappedByMe}
                        onClick={async () => {
                          await api.clap(d.id).catch(() => undefined);
                          load();
                        }}
                        className={cn(
                          "flex items-center gap-1 rounded-full border px-2 py-0.5 hover:bg-white dark:hover:bg-white/5",
                          d.clappedByMe
                            ? "border-primary-300 font-medium text-primary-700 dark:border-primary-500/40 dark:text-primary-300"
                            : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400",
                        )}
                      >
                        <HandHeart size={14} aria-hidden="true" /> Helpful
                        {d.claps > 0 ? ` · ${d.claps}` : ""}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyTo(replyTo === d.id ? null : d.id)}
                        className="flex items-center gap-1 text-neutral-600 hover:underline dark:text-neutral-400"
                      >
                        <MessageCircle size={14} aria-hidden="true" /> Reply
                        {d.replies.length > 0 ? ` · ${d.replies.length}` : ""}
                      </button>
                    </div>
                    {reportArea(d.id)}

                    {d.replies.length > 0 ? (
                      <ul className="mt-3 flex flex-col gap-3 border-l-2 border-neutral-200 pl-3 dark:border-neutral-700">
                        {d.replies.map((r) => (
                          <li key={r.id} className="flex gap-2.5">
                            <Avatar name={r.authorName} small />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-xs text-neutral-500">
                                  <span className="font-medium text-neutral-800 dark:text-white/90">
                                    {r.authorName}
                                  </span>{" "}
                                  · {timeAgo(r.createdAt)}
                                </div>
                                <PostMenu
                                  post={r}
                                  onDeleted={load}
                                  onReport={() => setReportFor(r.id)}
                                />
                              </div>
                              <DoubtMarkdown body={r.body} />
                              {reportArea(r.id)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {replyTo === d.id ? (
                      <div className="mt-3 flex flex-col gap-2">
                        <textarea
                          aria-label={`Reply to ${d.authorName}`}
                          ref={replyRef}
                          className="min-h-16 w-full rounded-md border border-neutral-300 bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900"
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                        />
                        {error ? (
                          <p role="alert" className="text-sm text-danger-600">
                            {error}
                          </p>
                        ) : null}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={busy || reply.trim().length < 2}
                            onClick={() => void postReply(d.id)}
                          >
                            Post reply
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </ToneCard>
            </li>
          ))}
        </ul>
      )}

      {composer ? (
        <DoubtComposer
          questionId={questionId}
          question={question}
          questionIndex={questionIndex}
          initialKind={composer}
          onClose={() => setComposer(null)}
          onPosted={() => {
            setNotice(
              composer === "DOUBT" ? "Your doubt is posted." : "Your explanation is posted.",
            );
            setComposer(null);
            load();
          }}
        />
      ) : null}
    </section>
  );
}
