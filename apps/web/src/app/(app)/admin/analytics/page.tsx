"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RequirePermission } from "@/components/require-permission";
import { RetryInline } from "@/components/ui/retry-inline";
import { SelectField } from "@/components/ui/select-field";
import { ChartCardSkeleton, StatGridSkeleton } from "@/components/analytics/skeletons";
import {
  DAY_RANGE_OPTIONS,
  useAdminAnalytics,
} from "@/components/analytics/admin/use-admin-analytics";
import { PlatformKpiSection } from "@/components/analytics/admin/platform-kpi-section";
import { UserGrowthSection } from "@/components/analytics/admin/user-growth-section";
import { EnrollmentSection } from "@/components/analytics/admin/enrollment-section";
import { RevenueSection } from "@/components/analytics/admin/revenue-section";
import { CoursePerformanceSection } from "@/components/analytics/admin/course-performance-section";
import { MentorPerformanceSection } from "@/components/analytics/admin/mentor-performance-section";
import { CommunitySection } from "@/components/analytics/admin/community-section";
import { NotificationsAnalyticsSection } from "@/components/analytics/admin/notifications-analytics-section";
import { AssignmentsAnalyticsSection } from "@/components/analytics/admin/assignments-analytics-section";
import { QuizzesAnalyticsSection } from "@/components/analytics/admin/quizzes-analytics-section";

function AdminAnalyticsContent() {
  const data = useAdminAnalytics();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-600"
          >
            <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
            Dashboard
          </Link>
          <h1 className="mt-1 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            Admin Analytics
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            How the platform is performing, end to end.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="w-40">
            <SelectField
              id="admin-analytics-range"
              label="Date range"
              value={String(data.days)}
              options={DAY_RANGE_OPTIONS}
              onChange={(v) => data.setDays(Number(v))}
            />
          </div>
          <Link
            href="/admin/reports"
            className="flex h-10 items-center rounded-md border border-neutral-200 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Reports →
          </Link>
        </div>
      </div>

      {data.staticStatus === "loading" ? (
        <div className="flex flex-col gap-8">
          <StatGridSkeleton count={5} />
          <StatGridSkeleton />
        </div>
      ) : data.staticStatus === "error" ? (
        <RetryInline message="Couldn't load platform analytics" onRetry={data.retryStatic} />
      ) : (
        <>
          {data.platform ? <PlatformKpiSection platform={data.platform} /> : null}
          <CoursePerformanceSection entries={data.coursePerformance} />
          <MentorPerformanceSection entries={data.mentorPerformance} />
          {data.assignments ? <AssignmentsAnalyticsSection assignments={data.assignments} /> : null}
          {data.quizzes ? <QuizzesAnalyticsSection quizzes={data.quizzes} /> : null}
          {data.notifications ? (
            <NotificationsAnalyticsSection notifications={data.notifications} />
          ) : null}
        </>
      )}

      <div className="border-t border-neutral-900/[0.06] pt-8">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Scoped to the selected date range
        </p>
      </div>

      {data.rangedStatus === "loading" ? (
        <div className="flex flex-col gap-8">
          <ChartCardSkeleton />
          <ChartCardSkeleton />
          <ChartCardSkeleton />
        </div>
      ) : data.rangedStatus === "error" ? (
        <RetryInline message="Couldn't load range-scoped analytics" onRetry={data.retryRanged} />
      ) : (
        <>
          {data.userGrowth ? <UserGrowthSection userGrowth={data.userGrowth} /> : null}
          {data.enrollment ? <EnrollmentSection enrollment={data.enrollment} /> : null}
          {data.revenue ? <RevenueSection revenue={data.revenue} /> : null}
          {data.community ? <CommunitySection community={data.community} /> : null}
        </>
      )}
    </main>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <RequirePermission permission="analytics:admin">
      <AdminAnalyticsContent />
    </RequirePermission>
  );
}
