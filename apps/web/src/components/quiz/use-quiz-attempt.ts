"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { AttemptQuestion, AttemptState } from "@examora/types";
import { useQuizApi } from "@/lib/quiz-api";
import type { AutosaveStatus } from "@/components/ui/autosave-indicator";
import type { AnswersMap } from "./types";

type LoadState = "loading" | "ready" | "not-found";

/** Rapid clicks on the same question (e.g. toggling multiple-choice options) collapse into one save. */
const AUTOSAVE_DEBOUNCE_MS = 400;
/** A failed save (network blip, rate limit, API restart) is retried automatically. */
const RETRY_DELAY_MS = 2000;
const MAX_AUTO_RETRIES = 5;

/**
 * Core attempt state machine — fetch, local answer mirror, autosave, a
 * client-side countdown anchored to the server's authoritative
 * remainingSeconds, and submit. The server independently auto-finalizes
 * expired attempts on its own next touch (finalizeIfExpired, called on every
 * read/write) — this client timer is a UX nicety that calls submit promptly,
 * not the actual source of truth for expiry.
 *
 * Autosave guarantees (the server grades only what it has stored, so a lost
 * save is a lost answer):
 *   - per-question debounce, so a burst of clicks sends one request;
 *   - saves for the same question are serialized, so a slow earlier request
 *     can never overwrite a newer answer;
 *   - failed saves are retried automatically and stay "unsynced" until one
 *     succeeds;
 *   - submit first flushes every unsynced answer, and refuses to submit
 *     (with a visible error) if any still can't be saved — except when the
 *     timer has run out, where the server's copy is final anyway;
 *   - a failed submit shows an error instead of navigating to a result page
 *     for an attempt that is still open;
 *   - the browser warns before closing the tab while answers are unsynced.
 */
export function useQuizAttempt(attemptId: string) {
  const api = useQuizApi();
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const router = useRouter();

  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [attempt, setAttempt] = React.useState<AttemptState | null>(null);
  const [answers, setAnswers] = React.useState<AnswersMap>({});
  const [remainingSeconds, setRemainingSeconds] = React.useState<number | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [autosaveStatus, setAutosaveStatus] = React.useState<AutosaveStatus>("idle");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const submittingRef = React.useRef(false);

  // Autosave bookkeeping lives in refs: it changes far more often than it needs to render.
  const latest = React.useRef<AnswersMap>({});
  const unsynced = React.useRef(new Set<string>());
  const failed = React.useRef(new Set<string>());
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const chains = React.useRef(new Map<string, Promise<boolean>>());
  const inFlight = React.useRef(0);
  const retries = React.useRef(new Map<string, number>());

  const refreshStatus = React.useCallback(() => {
    if (inFlight.current > 0 || timers.current.size > 0) setAutosaveStatus("saving");
    else if (failed.current.size > 0) setAutosaveStatus("error");
    else if (unsynced.current.size === 0)
      setAutosaveStatus((s) => (s === "idle" ? "idle" : "saved"));
  }, []);

  /** Saves the question's *current* answer, after any save already running for it. */
  const saveNow = React.useCallback(
    (questionId: string): Promise<boolean> => {
      const pending = timers.current.get(questionId);
      if (pending) {
        clearTimeout(pending);
        timers.current.delete(questionId);
      }
      const previous = chains.current.get(questionId) ?? Promise.resolve(true);
      const run = previous.then(async () => {
        if (!unsynced.current.has(questionId)) return true; // an earlier save already covered it
        const value = latest.current[questionId] ?? [];
        unsynced.current.delete(questionId);
        inFlight.current++;
        refreshStatus();
        try {
          await apiRef.current.autosaveAnswer(attemptId, questionId, value);
          failed.current.delete(questionId);
          retries.current.delete(questionId);
          return true;
        } catch {
          // Only mark as unsynced if nothing newer replaced it meanwhile.
          if (latest.current[questionId] === value) unsynced.current.add(questionId);
          failed.current.add(questionId);
          const attempts = (retries.current.get(questionId) ?? 0) + 1;
          retries.current.set(questionId, attempts);
          if (attempts <= MAX_AUTO_RETRIES && !submittingRef.current) {
            timers.current.set(
              questionId,
              setTimeout(() => void saveNow(questionId), RETRY_DELAY_MS * attempts),
            );
          }
          return false;
        } finally {
          inFlight.current--;
          refreshStatus();
        }
      });
      chains.current.set(questionId, run);
      return run;
    },
    [attemptId, refreshStatus],
  );

  /** Pushes every unsynced answer to the server; true when all of them are stored. */
  const flush = React.useCallback(async (): Promise<boolean> => {
    const ids = new Set([...unsynced.current, ...timers.current.keys()]);
    retries.current.clear();
    await Promise.all([...ids].map((id) => saveNow(id)));
    await Promise.all([...chains.current.values()]);
    return unsynced.current.size === 0;
  }, [saveNow]);

  const submit = React.useCallback(
    async (opts: { force?: boolean } = {}) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setSubmitError(null);
      try {
        const synced = await flush();
        if (!synced && !opts.force) {
          setSubmitError(
            "Some answers couldn't be saved yet. Check your connection and press Submit again — nothing has been submitted.",
          );
          return;
        }
        try {
          await apiRef.current.submitAttempt(attemptId);
        } catch {
          // The attempt may already be closed (e.g. the server auto-submitted it
          // when time ran out) — then the result page is the right place to go.
          const state = await apiRef.current.getAttempt(attemptId).catch(() => null);
          if (state?.status === "IN_PROGRESS") {
            setSubmitError("Submitting failed — your answers are saved. Please try again.");
            return;
          }
        }
        router.push(`/quizzes/attempts/${attemptId}/result`);
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [attemptId, flush, router],
  );

  React.useEffect(() => {
    let cancelled = false;
    apiRef.current
      .getAttempt(attemptId)
      .then((state) => {
        if (cancelled) return;
        if (state.status !== "IN_PROGRESS") {
          router.replace(`/quizzes/attempts/${attemptId}/result`);
          return;
        }
        setAttempt(state);
        setRemainingSeconds(state.remainingSeconds);
        const initial: AnswersMap = {};
        for (const q of state.questions) initial[q.questionId] = q.selectedOptionIds;
        latest.current = initial;
        setAnswers(initial);
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("not-found");
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId, router]);

  React.useEffect(() => {
    if (remainingSeconds === null) return;
    if (remainingSeconds <= 0) {
      void submit({ force: true });
      return;
    }
    const timer = setTimeout(() => setRemainingSeconds((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remainingSeconds, submit]);

  // Warn before closing/reloading the tab while answers are not yet stored,
  // and fire any debounced saves immediately if the page is left.
  React.useEffect(() => {
    const pendingTimers = timers.current;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (unsynced.current.size > 0 || inFlight.current > 0 || pendingTimers.size > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      for (const questionId of [...pendingTimers.keys()]) void saveNow(questionId);
    };
  }, [saveNow]);

  function toggleOption(question: AttemptQuestion, optionId: string): void {
    const current = latest.current[question.questionId] ?? [];
    const next =
      question.type === "MULTIPLE_CHOICE"
        ? current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId]
        : [optionId];

    latest.current = { ...latest.current, [question.questionId]: next };
    setAnswers(latest.current);
    unsynced.current.add(question.questionId);
    retries.current.delete(question.questionId);
    setSubmitError(null);

    const existing = timers.current.get(question.questionId);
    if (existing) clearTimeout(existing);
    timers.current.set(
      question.questionId,
      setTimeout(() => void saveNow(question.questionId), AUTOSAVE_DEBOUNCE_MS),
    );
    setAutosaveStatus("saving");
  }

  const questions = attempt?.questions ?? [];
  const answeredCount = Object.values(answers).filter((v) => v.length > 0).length;

  return {
    loadState,
    attempt,
    questions,
    answers,
    answeredCount,
    remainingSeconds,
    activeIndex,
    setActiveIndex,
    autosaveStatus,
    submitting,
    submitError,
    toggleOption,
    submit,
  };
}
