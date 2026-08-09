"use client";

import { useAuth } from "@examora/auth-client";
import { RequirePermission } from "@/components/require-permission";
import { RetryInline } from "@/components/ui/retry-inline";
import { authorDisplayName } from "@/lib/format";
import { ExecutiveHero } from "@/components/admin-dashboard/executive-hero";
import { KpiGrid } from "@/components/admin-dashboard/kpi-grid";
import { RevenueSection } from "@/components/admin-dashboard/revenue-section";
import { LearningSection } from "@/components/admin-dashboard/learning-section";
import { UserGrowthSection } from "@/components/admin-dashboard/user-growth-section";
import { CommunitySection } from "@/components/admin-dashboard/community-section";
import { CommerceSection } from "@/components/admin-dashboard/commerce-section";
import { NotificationSection } from "@/components/admin-dashboard/notification-section";
import { QuickActions } from "@/components/admin-dashboard/quick-actions";
import { RecentActivity } from "@/components/admin-dashboard/recent-activity";
import { useAdminDashboard } from "@/components/admin-dashboard/use-admin-dashboard";

function AdminDashboardContent() {
  const { user } = useAuth();
  const {
    status,
    platform,
    revenue,
    monthlyRevenue,
    growthPercent,
    coursePerformance,
    assignments,
    quizzes,
    userGrowth,
    community,
    notifications,
    health,
    recentOrders,
    refundQueue,
    moderationQueue,
    templateCount,
    recentActivity,
    retry,
  } = useAdminDashboard();

  if (status === "error") {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <RetryInline message="Couldn't load the dashboard" onRetry={retry} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      <ExecutiveHero name={user ? authorDisplayName(user) : "Admin"} health={health} />

      <KpiGrid
        status={status}
        platform={platform}
        revenue={revenue}
        community={community}
        notifications={notifications}
        growthPercent={growthPercent}
      />

      {status === "ready" ? (
        <>
          <RevenueSection revenue={revenue} monthlyRevenue={monthlyRevenue} />
          <LearningSection
            coursePerformance={coursePerformance}
            quizzes={quizzes}
            assignments={assignments}
          />
          <UserGrowthSection userGrowth={userGrowth} />
          <CommunitySection community={community} moderationQueue={moderationQueue} />
          <CommerceSection
            recentOrders={recentOrders}
            refundQueue={refundQueue}
            coursePerformance={coursePerformance}
            revenueCurrency={platform?.revenueCurrency ?? "INR"}
          />
          <NotificationSection notifications={notifications} templateCount={templateCount} />
          <QuickActions />
          <RecentActivity events={recentActivity} />
        </>
      ) : null}
    </main>
  );
}

export default function AdminDashboardPage() {
  return (
    <RequirePermission permission="analytics:admin">
      <AdminDashboardContent />
    </RequirePermission>
  );
}
