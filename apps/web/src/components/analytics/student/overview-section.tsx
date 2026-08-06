import { BookOpen, CheckCircle2, GraduationCap, TrendingUp } from "lucide-react";
import type { LearningProgressSummary } from "@examora/types";
import { StatCard } from "@/components/dashboard/stat-card";

export function OverviewSection({ progress }: { progress: LearningProgressSummary }) {
  return (
    <section aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="font-heading text-lg font-semibold text-neutral-900">
        Overview
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={BookOpen}
          tone="primary"
          label="Enrolled Courses"
          value={String(progress.enrolledCourseCount)}
          accessibleLabel="Enrolled courses"
        />
        <StatCard
          icon={TrendingUp}
          tone="accent"
          label="In Progress"
          value={String(progress.inProgressCourseCount)}
          accessibleLabel="Courses in progress"
        />
        <StatCard
          icon={CheckCircle2}
          tone="success"
          label="Completed"
          value={String(progress.completedCourseCount)}
          accessibleLabel="Completed courses"
        />
        <StatCard
          icon={GraduationCap}
          tone="warning"
          label="Overall Completion"
          value={`${progress.overallCompletionPercent}%`}
          accessibleLabel="Overall completion percentage across enrolled courses"
        />
      </div>
    </section>
  );
}
