"use client";

import { RequireAuth } from "@/components/require-auth";
import { RetryInline } from "@/components/ui/retry-inline";
import { ChartCardSkeleton, StatGridSkeleton } from "@/components/analytics/skeletons";
import { useStudentAnalytics } from "@/components/analytics/student/use-student-analytics";
import { OverviewSection } from "@/components/analytics/student/overview-section";
import { LearningProgressSection } from "@/components/analytics/student/learning-progress-section";
import { QuizPerformanceSection } from "@/components/analytics/student/quiz-performance-section";
import { AssignmentPerformanceSection } from "@/components/analytics/student/assignment-performance-section";
import { ActivityTimelineSection } from "@/components/analytics/student/activity-timeline-section";
import { AchievementsSection } from "@/components/analytics/student/achievements-section";
import { ContinueLearningSection } from "@/components/analytics/student/continue-learning-section";
import { PageTitle } from "@/components/ui/page-header";

function AnalyticsContent() {
  const data = useStudentAnalytics();

  return (
    <main className="flex flex-col gap-8">
      <div>
        <PageTitle>My Analytics</PageTitle>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          How you&rsquo;re progressing, what&rsquo;s going well, and where to focus next.
        </p>
      </div>

      {data.status === "loading" ? (
        <div className="flex flex-col gap-8">
          <StatGridSkeleton />
          <ChartCardSkeleton />
          <StatGridSkeleton />
        </div>
      ) : data.status === "error" ? (
        <RetryInline message="Couldn't load your analytics" onRetry={data.retry} />
      ) : (
        <>
          {data.progress ? <OverviewSection progress={data.progress} /> : null}
          <ContinueLearningSection items={data.continueLearning} />
          <LearningProgressSection courses={data.courses} />
          {data.quiz ? <QuizPerformanceSection quiz={data.quiz} /> : null}
          {data.assignments ? (
            <AssignmentPerformanceSection assignments={data.assignments} />
          ) : null}
          {data.activity ? (
            <ActivityTimelineSection activity={data.activity} timeline={data.timeline} />
          ) : null}
          {data.achievements ? <AchievementsSection achievements={data.achievements} /> : null}
        </>
      )}
    </main>
  );
}

export default function AnalyticsPage() {
  return (
    <RequireAuth>
      <AnalyticsContent />
    </RequireAuth>
  );
}
