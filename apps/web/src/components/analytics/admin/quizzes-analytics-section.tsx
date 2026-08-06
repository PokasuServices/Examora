import { HelpCircle, ListChecks, Percent, Target } from "lucide-react";
import type { AdminQuizAnalytics } from "@examora/types";
import { StatCard } from "@/components/dashboard/stat-card";

export function QuizzesAnalyticsSection({ quizzes }: { quizzes: AdminQuizAnalytics }) {
  return (
    <section aria-labelledby="admin-quizzes-heading">
      <h2
        id="admin-quizzes-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Quizzes
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard
          icon={HelpCircle}
          tone="primary"
          label="Quizzes"
          value={quizzes.totalQuizzes.toLocaleString()}
          accessibleLabel="Total quizzes"
        />
        <StatCard
          icon={ListChecks}
          tone="accent"
          label="Attempts"
          value={quizzes.totalAttempts.toLocaleString()}
          accessibleLabel="Total quiz attempts"
        />
        <StatCard
          icon={ListChecks}
          tone="success"
          label="Submitted"
          value={quizzes.submittedAttempts.toLocaleString()}
          accessibleLabel="Submitted quiz attempts"
        />
        <StatCard
          icon={Percent}
          tone="warning"
          label="Average Score"
          value={quizzes.averagePercentage !== null ? `${quizzes.averagePercentage}%` : "—"}
          accessibleLabel="Average quiz score"
        />
        <StatCard
          icon={Target}
          tone="success"
          label="Pass Rate"
          value={quizzes.passRate !== null ? `${quizzes.passRate}%` : "—"}
          accessibleLabel="Quiz pass rate"
        />
      </div>
    </section>
  );
}
