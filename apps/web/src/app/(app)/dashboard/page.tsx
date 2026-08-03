"use client";

import * as React from "react";
import { RequireAuth } from "@/components/require-auth";
import { TopNavigation } from "@/components/dashboard/top-navigation";
import { HeroSection } from "@/components/dashboard/hero-section";
import { ContinueLearning } from "@/components/dashboard/continue-learning";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { LearningProgress } from "@/components/dashboard/learning-progress";
import { RecommendedCourses } from "@/components/dashboard/recommended-courses";
import { UpcomingActivities } from "@/components/dashboard/upcoming-activities";
import { NotificationsWidget } from "@/components/dashboard/notifications-widget";
import { CommunityActivity } from "@/components/dashboard/community-activity";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { DashboardFooter } from "@/components/dashboard/footer";
import type { DashboardScope } from "@/components/dashboard/scope";

function DashboardContent() {
  const [scope, setScope] = React.useState<DashboardScope>("today");

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <TopNavigation scope={scope} onScopeChange={setScope} />

      <HeroSection />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_384px]">
        {/* Main column — things the student does */}
        <div className="flex flex-col gap-12 lg:order-1">
          <ContinueLearning />
          <KpiCards scope={scope} />
          <LearningProgress />
          <RecommendedCourses />
        </div>

        {/* Right rail — things the student is aware of */}
        <div className="flex flex-col gap-8 lg:order-2">
          <UpcomingActivities scope={scope} />
          <NotificationsWidget />
          <CommunityActivity />
          <QuickActions />
        </div>
      </div>

      <DashboardFooter />
    </main>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
