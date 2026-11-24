"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@examora/auth-client";
import type { AttemptQuestion, AttemptState } from "@examora/types";
import { useQuizApi } from "@/lib/quiz-api";
import type { AutosaveStatus } from "@/components/ui/autosave-indicator";
import { parseNumeric, type AnswersMap, type NumericMap } from "./types";

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
  const [numeric, setNumeric] = React.useState<NumericMap>({});
  const [remainingSeconds, setRemainingSeconds] = React.useState<number | null>(null);
  /** Timed-by-section tests: seconds left in the open section. */
  const [sectionRemaining, setSectionRemaining] = React.useState<number | null>(null);
  const [movingSection, setMovingSection] = React.useState(false);
  const [sectionError, setSectionError] = React.useState<string | null>(null);
  /** Questions whose content the server hid (their section hadn't started). */
  const hiddenIds = React.useRef<Set<string>>(new Set());
  const syncRef = React.useRef<() => Promise<void>>(async () => undefined);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [autosaveStatus, setAutosaveStatus] = React.useState<AutosaveStatus>("idle");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const submittingRef = React.useRef(false);

  // Autosave bookkeeping lives in refs: it changes far more often than it needs to render.
  const latest = React.useRef<AnswersMap>({});
  const latestNumeric = React.useRef<NumericMap>({});
  const numericIds = React.useRef(new Set<string>());
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
        const raw = latestNumeric.current[questionId];
        const isNumeric = numericIds.current.has(questionId);
        unsynced.current.delete(questionId);
        inFlight.current++;
        refreshStatus();
        try {
          await apiRef.current.autosaveAnswer(
            attemptId,
            questionId,
            isNumeric ? [] : value,
            isNumeric ? parseNumeric(raw) : undefined,
          );
          failed.current.delete(questionId);
          retries.current.delete(questionId);
          return true;
        } catch (err) {
          // 409: the section closed (or the attempt ended). That answer can no
          // longer change, so stop retrying it and reload the test state.
          if (err instanceof ApiError && err.status === 409) {
            unsynced.current.delete(questionId);
            failed.current.delete(questionId);
            retries.current.delete(questionId);
            void syncRef.current();
            return true;
          }
          // Only mark as unsynced if nothing newer replaced it meanwhile.
          if (latest.current[questionId] === value && latestNumeric.current[questionId] === raw) {
            unsynced.current.add(questionId);
          }
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
        } catch (err) {
          // The attempt may already be closed (e.g. the server auto-submitted it
          // when time ran out) — then the result page is the right place to go.
          const state = await apiRef.current.getAttempt(attemptId).catch(() => null);
          if (state?.status === "IN_PROGRESS") {
            // A 400 explains itself (e.g. "Open every question before submitting").
            const status = (err as { status?: number })?.status;
            setSubmitError(
              status === 400 && err instanceof Error
                ? err.message
                : "Submitting failed — your answers are saved. Please try again.",
            );
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

  /** Applies server state; answers for newly opened (previously hidden) questions come from the server. */
  const applyState = React.useCallback(
    (state: AttemptState, initialLoad: boolean) => {
      if (state.status !== "IN_PROGRESS") {
        router.replace(`/quizzes/attempts/${attemptId}/result`);
        return;
      }
      setAttempt(state);
      setRemainingSeconds(state.remainingSeconds);
      setSectionRemaining(state.timing ? state.timing.sectionRemainingSeconds : null);
      const nextAnswers: AnswersMap = { ...latest.current };
      const nextNumeric: NumericMap = { ...latestNumeric.current };
      const nowHidden = new Set<string>();
      for (const q of state.questions) {
        const hidden =
          state.timing !== null &&
          state.timing !== undefined &&
          state.timing.sections.find((x) => x.id === q.sectionId)?.status === "UPCOMING";
        if (hidden) nowHidden.add(q.questionId);
        if (initialLoad || hiddenIds.current.has(q.questionId) || !(q.questionId in nextAnswers)) {
          nextAnswers[q.questionId] = q.selectedOptionIds;
          if (q.type === "NUMERIC") {
            numericIds.current.add(q.questionId);
            nextNumeric[q.questionId] = q.numericAnswer === null ? "" : String(q.numericAnswer);
          }
        }
      }
      hiddenIds.current = nowHidden;
      latest.current = nextAnswers;
      latestNumeric.current = nextNumeric;
      setAnswers(nextAnswers);
      setNumeric(nextNumeric);
      // Keep the student inside the open section.
      if (state.timing) {
        const open = state.timing.currentSectionId;
        setActiveIndex((i) => {
          if (state.questions[i]?.sectionId === open) return i;
          const first = state.questions.findIndex((q) => q.sectionId === open);
          return first >= 0 ? first : i;
        });
      }
      setLoadState("ready");
    },
    [attemptId, router],
  );

  const syncState = React.useCallback(async () => {
    const state = await apiRef.current.getAttempt(attemptId).catch(() => null);
    if (state) applyState(state, false);
  }, [attemptId, applyState]);
  syncRef.current = syncState;

  React.useEffect(() => {
    let cancelled = false;
    apiRef.current
      .getAttempt(attemptId)
      .then((state) => {
        if (!cancelled) applyState(state, true);
      })
      .catch(() => {
        if (!cancelled) setLoadState("not-found");
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId, applyState]);

  /** Section clock: when it runs out the server opens the next section; fetch it. */
  React.useEffect(() => {
    if (sectionRemaining === null || !attempt?.timing) return;
    const last =
      attempt.timing.sections[attempt.timing.sections.length - 1]?.id ===
      attempt.timing.currentSectionId;
    if (sectionRemaining <= 0) {
      if (last) return; // the overall timer submits
      const t = setTimeout(() => {
        void flush().then(() => syncState());
      }, 1200);
      return () => clearTimeout(t);
    }
    const timer = setTimeout(() => setSectionRemaining((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [sectionRemaining, attempt, flush, syncState]);

  /** Finish the open section early and start the next one. */
  const nextSection = React.useCallback(async () => {
    setSectionError(null);
    setMovingSection(true);
    try {
      const saved = await flush();
      if (!saved) {
        setSectionError(
          "Some answers couldn't be saved yet. Check your connection and try again; you're still in this section.",
        );
        return false;
      }
      const state = await apiRef.current.nextSection(attemptId);
      applyState(state, false);
      return true;
    } catch (err) {
      setSectionError(
        err instanceof ApiError && err.status !== 0
          ? err.message
          : "Couldn't move to the next section. Try again.",
      );
      void syncState();
      return false;
    } finally {
      setMovingSection(false);
    }
  }, [attemptId, flush, applyState, syncState]);

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

  /** NUMERIC questions: store the typed text and autosave its parsed value (debounced). */
  function setNumericAnswer(question: AttemptQuestion, raw: string): void {
    latestNumeric.current = { ...latestNumeric.current, [question.questionId]: raw };
    setNumeric(latestNumeric.current);
    unsynced.current.add(question.questionId);
    retries.current.delete(question.questionId);
    setSubmitError(null);

    const existing = timers.current.get(question.questionId);
    if (existing) clearTimeout(existing);
    timers.current.set(
      question.questionId,
      setTimeout(() => void saveNow(question.questionId), AUTOSAVE_DEBOUNCE_MS * 2),
    );
    setAutosaveStatus("saving");
  }

  const questions = attempt?.questions ?? [];
  const isAnswered = (q: AttemptQuestion) =>
    q.type === "NUMERIC"
      ? parseNumeric(numeric[q.questionId]) !== null
      : (answers[q.questionId]?.length ?? 0) > 0;
  const answeredCount = questions.filter(isAnswered).length;

  return {
    loadState,
    attempt,
    questions,
    answers,
    numeric,
    isAnswered,
    answeredCount,
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
  };
}
