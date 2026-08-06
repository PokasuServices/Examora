"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RequirePermission } from "@/components/require-permission";
import { RetryInline } from "@/components/ui/retry-inline";
import { ChartCardSkeleton, StatGridSkeleton } from "@/components/analytics/skeletons";
import { useMentorAnalytics } from "@/components/analytics/mentor/use-mentor-analytics";
import { StudentProgressSection } from "@/components/analytics/mentor/student-progress-section";
import { PerformanceTrendsSection } from "@/components/analytics/mentor/performance-trends-section";
import { WorkloadSection } from "@/components/analytics/mentor/workload-section";
import { EngagementSection } from "@/components/analytics/mentor/engagement-section";
import { ReviewStatisticsSection } from "@/components/analytics/mentor/review-statistics-section";

function MentorAnalyticsContent() {
  const data = useMentorAnalytics();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/mentor/dashboard"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
        >
          <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
          Mentor Dashboard
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
          Mentor Analytics
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          How your students are performing, and where your time is going.
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
          <StudentProgressSection entries={data.studentProgress} />
          {data.quiz ? <PerformanceTrendsSection trends={data.trends} quiz={data.quiz} /> : null}
          {data.workload ? <WorkloadSection workload={data.workload} /> : null}
          {data.engagement ? <EngagementSection engagement={data.engagement} /> : null}
          {data.reviewStats ? <ReviewStatisticsSection reviewStats={data.reviewStats} /> : null}
        </>
      )}
    </main>
  );
}

export default function MentorAnalyticsPage() {
  return (
    <RequirePermission permission="analytics:mentor">
      <MentorAnalyticsContent />
    </RequirePermission>
  );
}
