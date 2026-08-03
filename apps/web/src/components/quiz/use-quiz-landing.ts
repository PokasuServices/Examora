"use client";

import * as React from "react";
import type { AttemptHistoryItem, QuizStudentDetail } from "@examora/types";
import { useQuizApi } from "@/lib/quiz-api";

type State =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "ready"; quiz: QuizStudentDetail; history: AttemptHistoryItem[] };

export function useQuizLanding(quizId: string) {
  const api = useQuizApi();
  const [state, setState] = React.useState<State>({ status: "loading" });
  const [starting, setStarting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    Promise.all([api.getQuiz(quizId), api.listHistory(quizId).catch(() => ({ items: [] }))]).then(
      ([quiz, historyRes]) => {
        if (cancelled) return;
        setState({ status: "ready", quiz, history: historyRes.items });
      },
      () => {
        if (!cancelled) setState({ status: "not-found" });
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  /**
   * Calling start again is how a student resumes (ADR-0014) — the backend
   * transparently returns the same IN_PROGRESS attempt rather than erroring
   * or creating a new one, so "Start" and "Resume" are the same call.
   */
  async function startOrResume(): Promise<string> {
    setStarting(true);
    try {
      const attempt = await api.startAttempt(quizId);
      return attempt.id;
    } finally {
      setStarting(false);
    }
  }

  return { ...state, starting, startOrResume };
}
