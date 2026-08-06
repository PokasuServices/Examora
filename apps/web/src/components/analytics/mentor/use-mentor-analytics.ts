"use client";

import * as React from "react";
import type {
  MentorAssignmentReviewStats,
  MentorEngagementSummary,
  MentorPerformanceTrendPoint,
  MentorQuizPerformanceSummary,
  MentorStudentProgressEntry,
  MentorWorkloadSummary,
} from "@examora/types";
import { useMentorApi } from "@/lib/mentor-api";

type Status = "loading" | "ready" | "error";

export function useMentorAnalytics() {
  const api = useMentorApi();

  const [status, setStatus] = React.useState<Status>("loading");
  const [studentProgress, setStudentProgress] = React.useState<MentorStudentProgressEntry[]>([]);
  const [trends, setTrends] = React.useState<MentorPerformanceTrendPoint[]>([]);
  const [quiz, setQuiz] = React.useState<MentorQuizPerformanceSummary | null>(null);
  const [reviewStats, setReviewStats] = React.useState<MentorAssignmentReviewStats | null>(null);
  const [workload, setWorkload] = React.useState<MentorWorkloadSummary | null>(null);
  const [engagement, setEngagement] = React.useState<MentorEngagementSummary | null>(null);

  const load = React.useCallback(() => {
    setStatus("loading");
    Promise.all([
      api.getStudentProgress(),
      api.getPerformanceTrends(),
      api.getQuizPerformance(),
      api.getAssignmentReviewStats(),
      api.getWorkload(),
      api.getEngagement(),
    ])
      .then(([sp, t, q, rs, w, e]) => {
        setStudentProgress(sp);
        setTrends(t);
        setQuiz(q);
        setReviewStats(rs);
        setWorkload(w);
        setEngagement(e);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return { status, studentProgress, trends, quiz, reviewStats, workload, engagement, retry: load };
}
