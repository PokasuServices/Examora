"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import type { LearningDashboard } from "@examora/types";
import { useLearningApi } from "@/lib/learning-api";
import { CardRail } from "@/components/ui/card-rail";
import { CourseCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { CourseCard } from "./course-card";

type State =
  { status: "loading" } | { status: "error" } | { status: "ready"; data: LearningDashboard };

export function ContinueLearning() {
  const api = useLearningApi();
  const [state, setState] = React.useState<State>({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    setState({ status: "loading" });
    api
      .getDashboard()
      .then((data) => setState({ status: "ready", data }))
      .catch(() => setState({ status: "error" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold text-neutral-900">Continue learning</h2>
        <Link href="/courses" className="text-sm font-medium text-primary-600 hover:underline">
          See all →
        </Link>
      </div>

      <div className="mt-4">
        {state.status === "loading" ? (
          <CardRail>
            <CourseCardSkeleton />
            <CourseCardSkeleton />
            <CourseCardSkeleton />
          </CardRail>
        ) : state.status === "error" ? (
          <RetryInline
            message="Couldn't load your courses"
            onRetry={() => setAttempt((a) => a + 1)}
          />
        ) : state.data.continueLearning.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            heading="Nothing in progress right now"
            body="Once you start a lesson, it'll show up here."
            actionLabel="Browse courses"
            actionHref="/courses"
          />
        ) : (
          <CardRail>
            {state.data.continueLearning.map((course) => (
              <CourseCard
                key={course.courseId}
                href={
                  course.nextLesson
                    ? `/courses/${course.courseId}/lessons/${course.nextLesson.id}`
                    : `/courses/${course.courseId}`
                }
                title={course.courseTitle}
                subtitle={course.nextLesson ? `Next: ${course.nextLesson.title}` : undefined}
                progressPercent={course.percentComplete}
              />
            ))}
          </CardRail>
        )}
      </div>
    </section>
  );
}
