"use client";

import * as React from "react";
import type { AnswerMethod, AttemptQuestion, AttemptQuestionMeta } from "@examora/types";
import { useStudentApi } from "@/lib/student-api";

/** Time on the open question is sent at least this often (and on every question change). */
const HEARTBEAT_MS = 20_000;

const EMPTY: AttemptQuestionMeta = {
  visited: false,
  flagged: false,
  method: null,
  timeSpentSeconds: 0,
  uploadRef: null,
};

/**
 * Test-screen bookkeeping alongside the answer autosave: marks questions
 * visited when opened, tracks time spent on the open question, and stores
 * flags and "how did you get it" answers. Failures are non-fatal (best effort).
 */
export function useAttemptMeta(
  attemptId: string,
  questions: AttemptQuestion[],
  activeQuestionId: string | null,
) {
  const api = useStudentApi();
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const [meta, setMeta] = React.useState<Record<string, AttemptQuestionMeta>>({});
  const openedAt = React.useRef<number>(Date.now());
  const initialised = React.useRef(false);

  React.useEffect(() => {
    if (initialised.current || questions.length === 0) return;
    initialised.current = true;
    setMeta(Object.fromEntries(questions.map((q) => [q.questionId, q.meta ?? EMPTY])));
  }, [questions]);

  const send = React.useCallback(
    (
      questionId: string,
      body: {
        visited?: boolean;
        flagged?: boolean;
        method?: AnswerMethod | null;
        addSeconds?: number;
      },
    ) => {
      void apiRef.current.questionMeta(attemptId, questionId, body).catch(() => undefined);
    },
    [attemptId],
  );

  const flushTime = React.useCallback(
    (questionId: string) => {
      const seconds = Math.round((Date.now() - openedAt.current) / 1000);
      openedAt.current = Date.now();
      if (seconds <= 0) return;
      setMeta((prev) => ({
        ...prev,
        [questionId]: {
          ...(prev[questionId] ?? EMPTY),
          timeSpentSeconds: (prev[questionId]?.timeSpentSeconds ?? 0) + seconds,
        },
      }));
      send(questionId, { addSeconds: Math.min(seconds, 600) });
    },
    [send],
  );

  // Opening a question: mark it visited; leaving it: record its time.
  React.useEffect(() => {
    if (!activeQuestionId) return;
    openedAt.current = Date.now();
    setMeta((prev) =>
      prev[activeQuestionId]?.visited
        ? prev
        : { ...prev, [activeQuestionId]: { ...(prev[activeQuestionId] ?? EMPTY), visited: true } },
    );
    send(activeQuestionId, { visited: true });
    const heartbeat = setInterval(() => flushTime(activeQuestionId), HEARTBEAT_MS);
    return () => {
      clearInterval(heartbeat);
      flushTime(activeQuestionId);
    };
  }, [activeQuestionId, send, flushTime]);

  const metaRef = React.useRef(meta);
  metaRef.current = meta;

  const toggleFlag = React.useCallback(
    (questionId: string) => {
      const flagged = !(metaRef.current[questionId]?.flagged ?? false);
      setMeta((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] ?? EMPTY), flagged } }));
      send(questionId, { flagged });
    },
    [send],
  );

  const setMethod = React.useCallback(
    (questionId: string, method: AnswerMethod) => {
      setMeta((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] ?? EMPTY), method } }));
      send(questionId, { method });
    },
    [send],
  );

  const setUploaded = React.useCallback((questionId: string, ref: string) => {
    setMeta((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] ?? EMPTY), uploadRef: ref },
    }));
  }, []);

  return { meta, toggleFlag, setMethod, setUploaded };
}
