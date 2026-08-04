"use client";

import { AlertTriangle } from "lucide-react";
import { RequirePermission } from "@/components/require-permission";
import { RetryInline } from "@/components/ui/retry-inline";
import { useMentorDashboardData } from "@/components/mentor/use-mentor-dashboard";
import { OverviewCards } from "@/components/mentor/overview-cards";
import { PendingReviewsList } from "@/components/mentor/pending-reviews-list";
import { RecentMeetingsList } from "@/components/mentor/recent-meetings-list";
import { RecentlyActiveStudents } from "@/components/mentor/recently-active-students";
import { QuickActions } from "@/components/mentor/quick-actions";
import { MentorDashboardSkeleton } from "@/components/mentor/skeletons";

function MentorDashboardContent() {
  const data = useMentorDashboardData();

  if (data.status === "loading") {
    return <MentorDashboardSkeleton />;
  }

  if (data.status === "error") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <RetryInline message="Couldn't load your mentor dashboard" onRetry={data.retry} />
      </main>
    );
  }

  const { dashboard, engagement, reviewStats, pendingReviews, studentProgress } = data;

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
          Mentor Dashboard
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {dashboard.profile.firstName
            ? `Welcome back, ${dashboard.profile.firstName}.`
            : "Welcome back."}{" "}
          Here&rsquo;s what needs your attention.
        </p>
      </div>

      <OverviewCards dashboard={dashboard} engagement={engagement} reviewStats={reviewStats} />

      <QuickActions />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <PendingReviewsList items={pendingReviews} />
        <RecentlyActiveStudents entries={studentProgress} />
        <RecentMeetingsList
          meetings={dashboard.recentMeetings}
          students={dashboard.assignedStudents}
        />
      </div>

      {engagement.studentsInactive14Days > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-danger-500/20 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <AlertTriangle
            size={16}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            {engagement.studentsInactive14Days}{" "}
            {engagement.studentsInactive14Days === 1 ? "student hasn't" : "students haven't"} been
            active in 14+ days.{" "}
            <a href="#recently-active-heading" className="font-medium underline">
              Review them
            </a>
            .
          </span>
        </div>
      ) : null}
    </main>
  );
}

export default function MentorDashboardPage() {
  return (
    <RequirePermission permission="mentor:workflow">
      <MentorDashboardContent />
    </RequirePermission>
  );
}
