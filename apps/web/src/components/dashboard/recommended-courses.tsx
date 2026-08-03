"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import type { CourseRecommendation } from "@examora/types";
import { useRecommendationsApi } from "@/lib/recommendations-api";
import { CardRail } from "@/components/ui/card-rail";
import { CourseCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { RetryInline } from "@/components/ui/retry-inline";
import { CourseCard } from "./course-card";

type State =
  { status: "loading" } | { status: "error" } | { status: "ready"; data: CourseRecommendation[] };

export function RecommendedCourses() {
  const api = useRecommendationsApi();
  const [state, setState] = React.useState<State>({ status: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    setState({ status: "loading" });
    api
      .getRecommendedCourses()
      .then((data) => setState({ status: "ready", data }))
      .catch(() => setState({ status: "error" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <section>
      <div className="flex items-center gap-2">
        <Sparkles size={18} strokeWidth={1.75} className="text-accent-500" aria-hidden="true" />
        <h2 className="font-heading text-xl font-semibold text-neutral-900">Recommended for you</h2>
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
            message="Couldn't load recommendations"
            onRetry={() => setAttempt((a) => a + 1)}
          />
        ) : state.data.length === 0 ? (
          // The engine already fails closed to an empty list (an admin
          // kill-switch, or a genuinely new student with no signal yet) — a
          // vanishing section reads as broken, so it stays present with an
          // honest prompt instead of a fabricated "popular courses" list
          // (no popularity ranking exists anywhere in the platform).
          <EmptyState
            heading="Nothing to recommend yet"
            body="Complete a lesson or two and we'll start suggesting what's next."
            actionLabel="Browse courses"
            actionHref="/courses"
          />
        ) : (
          <CardRail>
            {state.data.map((rec) => (
              <CourseCard
                key={rec.courseId}
                href={`/courses/${rec.courseId}`}
                title={rec.courseTitle}
                subtitle={rec.categoryName ?? undefined}
                reason={rec.reason}
              />
            ))}
          </CardRail>
        )}
      </div>
    </section>
  );
}
