import { Sparkles } from "lucide-react";
import type { ContinueLearningItem } from "@examora/types";
import { CardRail } from "@/components/ui/card-rail";
import { CourseCard } from "@/components/dashboard/course-card";
import { EmptyState } from "@/components/ui/empty-state";
import { timeAgo } from "@/lib/format";

/** Reuses the exact CourseCard/CardRail the Dashboard's own "Continue learning" rail uses, but sourced from /recommendations/me/continue-learning — the only endpoint that also carries the AI's real score/reason, which the Dashboard's simpler rail doesn't surface. */
export function ContinueLearningSection({ items }: { items: ContinueLearningItem[] }) {
  return (
    <section aria-labelledby="continue-learning-heading">
      <h2
        id="continue-learning-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Continue Learning Insights
      </h2>
      <div className="mt-3">
        {items.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            heading="Nothing in progress right now"
            body="Once you start a lesson, insights on what to continue will show up here."
            actionLabel="Browse courses"
            actionHref="/courses"
          />
        ) : (
          <CardRail>
            {items.map((item) => (
              <CourseCard
                key={item.courseId}
                href={
                  item.nextLesson
                    ? `/courses/${item.courseId}/lessons/${item.nextLesson.id}`
                    : `/courses/${item.courseId}`
                }
                title={item.courseTitle}
                subtitle={
                  item.nextLesson
                    ? `Next: ${item.nextLesson.title}`
                    : item.lastActivityAt
                      ? `Last active ${timeAgo(item.lastActivityAt)}`
                      : undefined
                }
                progressPercent={item.completionPercent}
                reason={item.reason}
              />
            ))}
          </CardRail>
        )}
      </div>
    </section>
  );
}
