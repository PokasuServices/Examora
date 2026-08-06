import { Award, CheckCircle2, GraduationCap, MessageSquareText, Star } from "lucide-react";
import type { AchievementSummary } from "@examora/types";
import { StatCard } from "@/components/dashboard/stat-card";

export function AchievementsSection({ achievements }: { achievements: AchievementSummary }) {
  return (
    <section aria-labelledby="achievements-heading">
      <h2 id="achievements-heading" className="font-heading text-lg font-semibold text-neutral-900">
        Achievements
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard
          icon={GraduationCap}
          tone="success"
          label="Courses Completed"
          value={String(achievements.coursesCompleted)}
          accessibleLabel="Courses completed"
        />
        <StatCard
          icon={CheckCircle2}
          tone="primary"
          label="Quizzes Passed"
          value={String(achievements.quizzesPassed)}
          accessibleLabel="Quizzes passed"
        />
        <StatCard
          icon={Star}
          tone="warning"
          label="Assignments Approved"
          value={String(achievements.assignmentsApproved)}
          accessibleLabel="Assignments approved"
        />
        <StatCard
          icon={Award}
          tone="accent"
          label="Reputation Points"
          value={String(achievements.reputationPoints)}
          accessibleLabel="Community reputation points"
        />
        <StatCard
          icon={MessageSquareText}
          tone="primary"
          label="Accepted Answers"
          value={String(achievements.communityAcceptedAnswers)}
          accessibleLabel="Accepted community answers"
        />
      </div>
    </section>
  );
}
