"use client";

import * as React from "react";
import type { ActivitySummary, CourseCompletionEntry } from "@examora/types";
import { useAnalyticsApi } from "@/lib/analytics-api";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RetryInline } from "@/components/ui/retry-inline";
import { cn } from "@examora/ui";

type Loadable<T> = { status: "loading" | "error" | "ready"; data: T | null };

function useLoadable<T>(fetcher: () => Promise<T>): Loadable<T> & { retry: () => void } {
  const [state, setState] = React.useState<Loadable<T>>({ status: "loading", data: null });
  const [attempt, setAttempt] = React.useState(0);
  const fetcherRef = React.useRef(fetcher);
  fetcherRef.current = fetcher;

  React.useEffect(() => {
    setState({ status: "loading", data: null });
    fetcherRef
      .current()
      .then((data) => setState({ status: "ready", data }))
      .catch(() => setState({ status: "error", data: null }));
  }, [attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}

/**
 * No "minutes studied per day" exists anywhere in the schema — only
 * day-level activity presence (LessonProgress.lastViewedAt, the same query
 * that computes the streak). Adapted from the spec's 7-day minutes bar
 * chart to a 7-dot activity strip: `last7DaysActiveDays` filled dots out of
 * 7, an honest metric rather than a fabricated one. See the accompanying
 * visually-hidden text equivalent for screen readers.
 */
function ActivityStrip({ activity }: { activity: ActivitySummary }) {
  const activeDots = Math.min(7, activity.last7DaysActiveDays);
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-700">This week</p>
        <p className="text-sm tabular-nums text-neutral-500">{activeDots} of 7 days active</p>
      </div>
      <div
        className="mt-3 flex gap-2"
        role="img"
        aria-label={`Active ${activeDots} of the last 7 days`}
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn(
              "h-8 flex-1 rounded-md",
              i < activeDots ? "bg-primary-500" : "bg-neutral-100",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function CourseProgressRow({ entry }: { entry: CourseCompletionEntry }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <p className="min-w-0 flex-1 truncate text-sm text-neutral-700">{entry.courseTitle}</p>
      <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-primary-600"
          style={{ width: `${entry.completionPercent}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-neutral-500">
        {entry.completionPercent}%
      </span>
    </div>
  );
}

export function LearningProgress() {
  const api = useAnalyticsApi();
  const activity = useLoadable(() => api.getActivity());
  const courses = useLoadable(() => api.getCourseCompletion());

  return (
    <section>
      <h2 className="font-heading text-xl font-semibold text-neutral-900">Learning progress</h2>
      <Card className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          {activity.status === "loading" ? (
            <div>
              <Skeleton className="h-4 w-24" />
              <div className="mt-3 flex gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 flex-1 rounded-md" />
                ))}
              </div>
            </div>
          ) : activity.status === "error" || !activity.data ? (
            <RetryInline message="Couldn't load your activity" onRetry={activity.retry} />
          ) : (
            <ActivityStrip activity={activity.data} />
          )}
        </div>

        <div className="border-t border-neutral-100 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <p className="text-sm font-medium text-neutral-700">Active courses</p>
          <div className="mt-2 divide-y divide-neutral-100">
            {courses.status === "loading" ? (
              <>
                <Skeleton className="my-2 h-5 w-full" />
                <Skeleton className="my-2 h-5 w-full" />
              </>
            ) : courses.status === "error" || !courses.data ? (
              <RetryInline message="Couldn't load your courses" onRetry={courses.retry} />
            ) : courses.data.length === 0 ? (
              <p className="py-2 text-sm text-neutral-500">
                Enroll in a course to see progress here.
              </p>
            ) : (
              courses.data.map((entry) => <CourseProgressRow key={entry.courseId} entry={entry} />)
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}
