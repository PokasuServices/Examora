"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { AttemptQuestion, AttemptState } from "@examora/types";
import { useQuizApi } from "@/lib/quiz-api";
import type { AutosaveStatus } from "@/components/ui/autosave-indicator";
import type { AnswersMap } from "./types";

type LoadState = "loading" | "ready" | "not-found";

/**
 * Core attempt state machine — fetch, local answer mirror, autosave (now
 * with a real status derived from the actual request lifecycle, not a
 * fabricated indicator), client-side countdown anchored to the server's
 * authoritative remainingSeconds, and submit. The server independently
 * auto-finalizes expired attempts on its own next touch (finalizeIfExpired,
 * called on every read/write) — this client timer is a UX nicety that
 * calls submit promptly, not the actual source of truth for expiry.
 */
export function useQuizAttempt(attemptId: string) {
  const api = useQuizApi();
  const router = useRouter();

  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [attempt, setAttempt] = React.useState<AttemptState | null>(null);
  const [answers, setAnswers] = React.useState<AnswersMap>({});
  const [remainingSeconds, setRemainingSeconds] = React.useState<number | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [autosaveStatus, setAutosaveStatus] = React.useState<AutosaveStatus>("idle");
  const [submitting, setSubmitting] = React.useState(false);
  const submittingRef = React.useRef(false);
  const autosaveGeneration = React.useRef(0);

  const submit = React.useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await api.submitAttempt(attemptId);
    } finally {
      router.push(`/quizzes/attempts/${attemptId}/result`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  React.useEffect(() => {
    let cancelled = false;
    api
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
        setAnswers(initial);
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("not-found");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  React.useEffect(() => {
    if (remainingSeconds === null) return;
    if (remainingSeconds <= 0) {
      void submit();
      return;
    }
    const timer = setTimeout(() => setRemainingSeconds((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remainingSeconds, submit]);

  function toggleOption(question: AttemptQuestion, optionId: string): void {
    const current = answers[question.questionId] ?? [];
    const next =
      question.type === "MULTIPLE_CHOICE"
        ? current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId]
        : [optionId];

    setAnswers((prev) => ({ ...prev, [question.questionId]: next }));

    const generation = ++autosaveGeneration.current;
    setAutosaveStatus("saving");
    api
      .autosaveAnswer(attemptId, question.questionId, next)
      .then(() => {
        if (autosaveGeneration.current === generation) setAutosaveStatus("saved");
      })
      .catch(() => {
        if (autosaveGeneration.current === generation) setAutosaveStatus("error");
      });
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
    toggleOption,
    submit,
  };
}
