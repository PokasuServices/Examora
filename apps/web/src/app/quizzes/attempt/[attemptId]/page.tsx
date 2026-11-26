"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  Dices,
  Filter,
  Flag,
  HelpCircle,
  Lock,
  MessageSquareWarning,
  SkipForward,
} from "lucide-react";
import type { AnswerMethod, AttemptQuestion } from "@examora/types";
import { Button, cn } from "@examora/ui";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState } from "@/components/ui/empty-state";
import { useQuizAttempt } from "@/components/quiz/use-quiz-attempt";
import { useAttemptMeta } from "@/components/quiz/use-attempt-meta";
import { useAttemptKeyboardShortcuts } from "@/components/quiz/use-attempt-keyboard-shortcuts";
import { AttemptHeader } from "@/components/quiz/attempt-header";
import { QuizQuestionCard } from "@/components/quiz/quiz-question-card";
import { SketchUpload } from "@/components/quiz/sketch-upload";
import { FinishSummaryDialog, type FinishItem } from "@/components/quiz/finish-summary-dialog";
import { METHOD_LABEL, useStudentApi } from "@/lib/student-api";

const METHODS: AnswerMethod[] = ["KNOWLEDGE", "ELIMINATION", "GUESS"];

/** The three answer methods, in the same colours as the report. */
const METHOD_STYLE: Record<AnswerMethod, { icon: typeof Brain; on: string; hint: string }> = {
  KNOWLEDGE: {
    icon: Brain,
    on: "border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-500 dark:bg-blue-500/15 dark:text-blue-200",
    hint: "I knew the concept or formula",
  },
  ELIMINATION: {
    icon: Filter,
    on: "border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-500 dark:bg-amber-500/15 dark:text-amber-200",
    hint: "I ruled out the wrong options",
  },
  GUESS: {
    icon: Dices,
    on: "border-rose-500 bg-rose-50 text-rose-800 ring-1 ring-rose-500 dark:bg-rose-500/15 dark:text-rose-200",
    hint: "I wasn't sure, I guessed",
  },
};

function ReportDialog({
  open,
  onClose,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (message: string) => Promise<void>;
}) {
  const [message, setMessage] = React.useState("");
  const [state, setState] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  React.useEffect(() => {
    if (open) {
      setMessage("");
      setState("idle");
    }
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="relative w-full max-w-md rounded-card border border-neutral-200 bg-white p-6 shadow-soft-hover dark:border-neutral-800 dark:bg-neutral-900"
      >
        <h2 id="report-title" className="text-lg font-medium text-neutral-800 dark:text-white/90">
          Report a problem with this question
        </h2>
        {state === "sent" ? (
          <p className="mt-3 text-sm text-success-600">Thanks. The content team will check it.</p>
        ) : (
          <>
            <label
              htmlFor="report-message"
              className="mt-3 block text-sm text-neutral-600 dark:text-neutral-400"
            >
              What&rsquo;s wrong? (e.g. wrong answer key, typo, unclear figure)
            </label>
            <textarea
              id="report-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-2 min-h-24 w-full rounded-md border border-neutral-300 bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-900"
            />
            {state === "error" ? (
              <p className="mt-2 text-sm text-danger-600">Couldn&rsquo;t send. Try again.</p>
            ) : null}
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {state === "sent" ? "Close" : "Cancel"}
          </Button>
          {state !== "sent" ? (
            <Button
              disabled={message.trim().length < 3 || state === "sending"}
              onClick={async () => {
                setState("sending");
                try {
                  await onSend(message.trim());
                  setState("sent");
                } catch {
                  setState("error");
                }
              }}
            >
              {state === "sending" ? "Sending…" : "Send report"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Confirm finishing a section early: the next one starts with its full time and this one closes. */
function SectionConfirmDialog({
  from,
  to,
  minutes,
  busy,
  onCancel,
  onConfirm,
}: {
  from: string;
  to: string;
  minutes: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const stayRef = React.useRef<HTMLButtonElement>(null);
  // Focus the safe choice first.
  React.useEffect(() => stayRef.current?.focus(), []);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/40" onClick={onCancel} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="section-confirm-title"
        aria-describedby="section-confirm-body"
        className="relative w-full max-w-md rounded-card border border-neutral-200 bg-white p-6 shadow-soft-hover dark:border-neutral-800 dark:bg-neutral-900"
      >
        <h2
          id="section-confirm-title"
          className="text-lg font-medium text-neutral-800 dark:text-white/90"
        >
          Finish {from}?
        </h2>
        <p
          id="section-confirm-body"
          className="mt-2 text-sm text-neutral-600 dark:text-neutral-400"
        >
          You can&rsquo;t come back to {from} after this. {to} starts now with its full {minutes}{" "}
          minutes.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={stayRef} variant="ghost" onClick={onCancel} disabled={busy}>
            Stay in {from}
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? "Moving on…" : `Start ${to}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

type Tone = "current" | "answered" | "skipped" | "unseen";

const TONE_CLASS: Record<Tone, string> = {
  current:
    "ring-2 ring-primary-500 ring-offset-1 bg-white text-primary-700 dark:bg-neutral-900 dark:text-primary-300",
  answered: "bg-emerald-500 text-white",
  skipped:
    "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-500/40",
  unseen:
    "border border-neutral-300 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400",
};

function Navigator({
  questions,
  sections,
  activeIndex,
  toneOf,
  flagged,
  onSelect,
  sectionStatus,
}: {
  questions: AttemptQuestion[];
  sections: { id: string; title: string }[];
  activeIndex: number;
  toneOf: (q: AttemptQuestion) => Tone;
  flagged: (q: AttemptQuestion) => boolean;
  onSelect: (i: number) => void;
  /** Timed-by-section tests: only the open section can be visited. */
  sectionStatus?: (sectionId: string | null) => "DONE" | "CURRENT" | "UPCOMING" | null;
}) {
  const indexed = questions.map((q, i) => ({ q, i }));
  const groups =
    sections.length > 0
      ? sections
          .map((s) => ({
            id: s.id as string | null,
            title: s.title,
            items: indexed.filter(({ q }) => q.sectionId === s.id),
          }))
          .filter((g) => g.items.length > 0)
      : [{ id: null as string | null, title: "", items: indexed }];
  const ungrouped = sections.length > 0 ? indexed.filter(({ q }) => !q.sectionId) : [];
  if (ungrouped.length > 0) groups.push({ id: null, title: "Other", items: ungrouped });

  return (
    <nav aria-label="Questions" className="flex flex-col gap-4">
      {groups.map((g) => {
        const status = sectionStatus?.(g.id) ?? null;
        const locked = status === "DONE" || status === "UPCOMING";
        return (
          <div key={g.title || "all"} className={cn(locked && "opacity-60")}>
            {g.title ? (
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {locked ? <Lock size={12} aria-hidden="true" /> : null}
                {g.title}
                {status === "DONE" ? <span className="font-normal">· closed</span> : null}
                {status === "UPCOMING" ? <span className="font-normal">· starts later</span> : null}
                {status === "CURRENT" ? (
                  <span className="font-normal text-primary-600 dark:text-primary-400">· now</span>
                ) : null}
              </p>
            ) : null}
            <ol className="grid grid-cols-6 gap-1.5">
              {g.items.map(({ q, i }) => (
                <li key={q.questionId}>
                  <button
                    type="button"
                    onClick={() => onSelect(i)}
                    disabled={locked}
                    aria-current={i === activeIndex ? "step" : undefined}
                    aria-label={`Question ${i + 1}${flagged(q) ? ", flagged" : ""}${locked ? (status === "DONE" ? ", section closed" : ", section not started") : ""}`}
                    className={cn(
                      "relative flex h-9 w-full items-center justify-center rounded-md text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                      TONE_CLASS[i === activeIndex ? "current" : toneOf(q)],
                    )}
                  >
                    {i + 1}
                    {flagged(q) ? (
                      <span
                        aria-hidden="true"
                        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-violet-500 ring-2 ring-white dark:ring-neutral-900"
                      />
                    ) : null}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-emerald-500" aria-hidden="true" /> Answered
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded bg-amber-100 ring-1 ring-inset ring-amber-300"
            aria-hidden="true"
          />{" "}
          Skipped
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-neutral-300" aria-hidden="true" /> Not
          visited
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-500" aria-hidden="true" /> Flagged
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded ring-2 ring-primary-500" aria-hidden="true" /> Current
        </li>
      </ul>
    </nav>
  );
}

function AttemptContent() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const studentApi = useStudentApi();
  const {
    loadState,
    attempt,
    questions,
    answers,
    numeric,
    isAnswered,
    remainingSeconds,
    sectionRemaining,
    nextSection,
    movingSection,
    sectionError,
    activeIndex,
    setActiveIndex,
    autosaveStatus,
    submitting,
    submitError,
    toggleOption,
    setNumericAnswer,
    submit,
  } = useQuizAttempt(attemptId);
  const question = questions[activeIndex];
  const { meta, toggleFlag, setMethod, setUploaded } = useAttemptMeta(
    attemptId,
    questions,
    question?.questionId ?? null,
  );
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  /** Set when the student tries to leave an answered question without saying how they got it. */
  const [methodNudge, setMethodNudge] = React.useState(false);
  const [sectionConfirmOpen, setSectionConfirmOpen] = React.useState(false);
  const timing = attempt?.timing ?? null;
  /** Indexes the student may visit: the open section when timed by section, else all. */
  const scope = React.useMemo(
    () =>
      questions
        .map((q, i) => ({ q, i }))
        .filter(({ q }) => !timing || q.sectionId === timing.currentSectionId)
        .map(({ i }) => i),
    [questions, timing],
  );

  React.useEffect(() => setMethodNudge(false), [activeIndex]);

  const answered = React.useCallback(
    (q: AttemptQuestion) =>
      q.type === "UPLOAD" ? Boolean(meta[q.questionId]?.uploadRef) : isAnswered(q),
    [meta, isAnswered],
  );

  /** Answered (not a sketch) but "how did you get it" not chosen yet. */
  const needsMethod = React.useCallback(
    (q: AttemptQuestion | undefined) =>
      Boolean(q && q.type !== "UPLOAD" && isAnswered(q) && !meta[q.questionId]?.method),
    [isAnswered, meta],
  );
  const blocked = React.useCallback(() => {
    if (!needsMethod(question)) return false;
    setMethodNudge(true);
    return true;
  }, [needsMethod, question]);

  const navigate = React.useCallback(
    (direction: -1 | 1) => {
      if (blocked()) return;
      setActiveIndex((i) => {
        const pos = scope.indexOf(i);
        if (pos < 0) return scope[0] ?? i;
        return scope[Math.min(scope.length - 1, Math.max(0, pos + direction))] ?? i;
      });
    },
    [scope, setActiveIndex, blocked],
  );
  const goTo = React.useCallback(
    (index: number) => {
      if (index !== activeIndex && blocked()) return;
      setActiveIndex(index);
    },
    [activeIndex, blocked, setActiveIndex],
  );
  const handleToggle = React.useCallback(
    (optionId: string) => {
      if (question) toggleOption(question, optionId);
    },
    [question, toggleOption],
  );
  useAttemptKeyboardShortcuts(question, navigate, handleToggle);

  if (loadState === "not-found") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={HelpCircle}
          heading="Attempt not available"
          body="This attempt doesn't exist or doesn't belong to you."
          actionLabel="Back to practice"
          actionHref="/practice"
        />
      </main>
    );
  }
  if (loadState === "loading" || !attempt || !question) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      </main>
    );
  }

  const current = question;
  const qMeta = meta[current.questionId];
  const isLast = activeIndex === scope[scope.length - 1];
  const isFirst = activeIndex === scope[0];
  const seenCount = questions.filter((q) => meta[q.questionId]?.visited).length;
  const scopeUnseen = scope.filter((i) => !meta[questions[i]!.questionId]?.visited).length;
  const unseen = scopeUnseen;
  const mustVisit = attempt.requireAllVisited === true && unseen > 0;
  const openIndex = timing ? timing.sections.findIndex((x) => x.status === "CURRENT") : -1;
  const openSection = timing ? timing.sections[openIndex] : undefined;
  const nextTimed = timing ? timing.sections[openIndex + 1] : undefined;
  const statusOf = (sectionId: string | null) =>
    timing ? (timing.sections.find((x) => x.id === sectionId)?.status ?? null) : null;
  const answeredCount = questions.filter(answered).length;
  const sectionTitle = attempt.sections?.find((s) => s.id === current.sectionId)?.title;

  const currentNeedsMethod = needsMethod(current);
  const currentAnswered = answered(current);

  function chooseMethod(method: AnswerMethod) {
    setMethod(current.questionId, method);
    setMethodNudge(false);
  }

  function openFinish() {
    if (blocked()) return;
    if (nextTimed) setSectionConfirmOpen(true);
    else setConfirmOpen(true);
  }

  const stateOf = (q: AttemptQuestion): FinishItem["state"] =>
    answered(q) ? "answered" : meta[q.questionId]?.visited ? "skipped" : "unseen";
  const finishItems: FinishItem[] = questions.map((q, i) => ({
    index: i,
    state: stateOf(q),
    flagged: meta[q.questionId]?.flagged ?? false,
    sectionTitle: attempt.sections?.find((s) => s.id === q.sectionId)?.title ?? null,
    reachable: scope.includes(i),
  }));

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-white/[0.03]">
      <AttemptHeader
        quizId={attempt.quizId}
        quizTitle={attempt.quizTitle}
        remainingSeconds={timing ? sectionRemaining : remainingSeconds}
        timerLabel={openSection?.title}
        answeredCount={answeredCount}
        totalCount={questions.length}
        autosaveStatus={autosaveStatus}
      />

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_19rem]">
        <main className="flex min-w-0 flex-col gap-4">
          {openSection ? (
            <div className="rounded-card border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-neutral-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-neutral-300">
              <p className="font-medium text-neutral-900 dark:text-white/90">
                {openSection.title}: section {openIndex + 1} of {timing!.sections.length}
              </p>
              <p className="text-xs">
                This section has its own time ({openSection.minutes} min).
                {openIndex > 0 ? " Earlier sections are closed." : ""}
                {nextTimed
                  ? ` When it ends you move to ${nextTimed.title} automatically.`
                  : " When it ends the test is submitted."}
              </p>
            </div>
          ) : sectionTitle ? (
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {sectionTitle}
            </p>
          ) : null}

          {current.type === "UPLOAD" ? (
            <div className="rounded-card border border-neutral-200 bg-white p-6 shadow-soft dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-medium text-neutral-400">Question {activeIndex + 1}</p>
              <p className="mt-1 whitespace-pre-line text-lg font-medium leading-relaxed text-neutral-900 dark:text-white/90">
                {current.text}
              </p>
              <p className="mt-2 text-xs text-neutral-500">
                {current.marks} marks · Marked by a reviewer after you submit
              </p>
              <SketchUpload
                attemptId={attemptId}
                questionId={current.questionId}
                criteria={current.criteria ?? []}
                uploadedRef={qMeta?.uploadRef ?? null}
                onUploaded={(ref) => setUploaded(current.questionId, ref)}
              />
            </div>
          ) : (
            <QuizQuestionCard
              question={current}
              index={activeIndex}
              selectedOptionIds={answers[current.questionId] ?? []}
              numericValue={numeric[current.questionId] ?? ""}
              onToggle={handleToggle}
              onNumericChange={(raw) => setNumericAnswer(current, raw)}
            />
          )}

          {current.type !== "UPLOAD" ? (
            <div
              role="radiogroup"
              aria-labelledby="method-q"
              aria-describedby="method-help"
              className={cn(
                "rounded-card border p-4 transition-colors motion-reduce:transition-none",
                !currentAnswered
                  ? "border-dashed border-neutral-300 bg-white/60 dark:border-neutral-700 dark:bg-white/[0.02]"
                  : methodNudge
                    ? "border-rose-300 bg-rose-50/70 dark:border-rose-500/40 dark:bg-rose-500/10"
                    : "border-primary-200 bg-primary-50/70 dark:border-primary-500/30 dark:bg-primary-500/10",
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p
                  id="method-q"
                  className="text-sm font-medium text-neutral-800 dark:text-white/90"
                >
                  How did you get this answer?
                </p>
                <p
                  id="method-help"
                  aria-live="polite"
                  className={cn(
                    "text-xs",
                    methodNudge
                      ? "font-medium text-rose-700 dark:text-rose-300"
                      : "text-neutral-500",
                  )}
                >
                  {!currentAnswered
                    ? "Pick an answer first, or skip the question."
                    : methodNudge
                      ? "Choose one to continue."
                      : qMeta?.method
                        ? "Saved. You can change it."
                        : "Required before you move on."}
                </p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {METHODS.map((m) => {
                  const style = METHOD_STYLE[m];
                  const Icon = style.icon;
                  const selected = qMeta?.method === m && currentAnswered;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!currentAnswered}
                      onClick={() => chooseMethod(m)}
                      className={cn(
                        "flex items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
                        selected
                          ? style.on
                          : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
                      )}
                    >
                      <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
                      <span>
                        <span className="block font-medium">{METHOD_LABEL[m]}</span>
                        <span className="block text-xs opacity-75">{style.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" disabled={isFirst} onClick={() => navigate(-1)}>
                <ArrowLeft size={16} aria-hidden="true" /> Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleFlag(current.questionId)}
                aria-pressed={qMeta?.flagged ?? false}
              >
                <Flag
                  size={16}
                  aria-hidden="true"
                  className={qMeta?.flagged ? "fill-warning-500 text-warning-500" : ""}
                />
                {qMeta?.flagged ? "Flagged" : "Flag"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>
                <MessageSquareWarning size={16} aria-hidden="true" /> Report
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isLast ? (
                <Button
                  size="sm"
                  disabled={currentNeedsMethod || (mustVisit && !nextTimed)}
                  onClick={openFinish}
                >
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {nextTimed ? `Finish ${openSection!.title}` : "Finish"}
                </Button>
              ) : currentAnswered ? (
                <Button size="sm" disabled={currentNeedsMethod} onClick={() => navigate(1)}>
                  Next <ArrowRight size={16} aria-hidden="true" />
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => navigate(1)}>
                  <SkipForward size={16} aria-hidden="true" /> Skip
                </Button>
              )}
            </div>
          </div>
        </main>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-card border border-neutral-200 bg-white p-4 shadow-soft dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-3 flex items-baseline justify-between text-sm">
              <span className="font-medium text-neutral-800 dark:text-white/90">Questions</span>
              <span className="text-xs text-neutral-500">
                {answeredCount} answered · {seenCount}/{questions.length} seen
              </span>
            </div>
            <Navigator
              questions={questions}
              sections={attempt.sections ?? []}
              activeIndex={activeIndex}
              toneOf={stateOf}
              flagged={(q) => meta[q.questionId]?.flagged ?? false}
              onSelect={goTo}
              sectionStatus={timing ? statusOf : undefined}
            />
          </div>
          {nextTimed ? (
            <Button onClick={openFinish} disabled={mustVisit || movingSection}>
              {movingSection
                ? "Moving on…"
                : `Finish ${openSection!.title} and start ${nextTimed.title}`}
            </Button>
          ) : (
            <Button onClick={openFinish} disabled={mustVisit}>
              Finish test
            </Button>
          )}
          {mustVisit ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Open the remaining {unseen} question{unseen === 1 ? "" : "s"}
              {timing ? " in this section" : ""} to continue.
            </p>
          ) : null}
          {sectionError ? (
            <p role="alert" className="text-xs text-danger-600">
              {sectionError}
            </p>
          ) : null}
        </aside>
      </div>

      <FinishSummaryDialog
        open={confirmOpen}
        items={finishItems}
        remainingSeconds={timing ? sectionRemaining : remainingSeconds}
        submitting={submitting}
        error={submitError}
        onJump={(index) => {
          setConfirmOpen(false);
          setActiveIndex(index);
        }}
        onSubmit={() => void submit()}
        onClose={() => setConfirmOpen(false)}
      />
      {sectionConfirmOpen && openSection && nextTimed ? (
        <SectionConfirmDialog
          from={openSection.title}
          to={nextTimed.title}
          minutes={nextTimed.minutes}
          busy={movingSection}
          onCancel={() => setSectionConfirmOpen(false)}
          onConfirm={async () => {
            const ok = await nextSection();
            if (ok) setSectionConfirmOpen(false);
          }}
        />
      ) : null}
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSend={(message) => studentApi.reportQuestion(current.questionId, message, attemptId)}
      />
    </div>
  );
}

export default function AttemptPage() {
  return (
    <RequireAuth>
      <AttemptContent />
    </RequireAuth>
  );
}
