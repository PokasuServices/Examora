import Link from "next/link";
import type { QuizPerformanceSummary } from "@examora/types";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { ListChecks, Percent, Target, Trophy } from "lucide-react";

export function QuizPerformanceSection({ quiz }: { quiz: QuizPerformanceSummary }) {
  return (
    <section aria-labelledby="quiz-performance-heading">
      <h2
        id="quiz-performance-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Quiz Performance
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={ListChecks}
          tone="primary"
          label="Attempts Submitted"
          value={String(quiz.attemptsSubmitted)}
          accessibleLabel="Quiz attempts submitted"
        />
        <StatCard
          icon={Percent}
          tone="accent"
          label="Average Score"
          value={quiz.averagePercentage !== null ? `${quiz.averagePercentage}%` : "—"}
          accessibleLabel="Average quiz score"
        />
        <StatCard
          icon={Trophy}
          tone="warning"
          label="Best Score"
          value={quiz.bestPercentage !== null ? `${quiz.bestPercentage}%` : "—"}
          accessibleLabel="Best quiz score"
        />
        <StatCard
          icon={Target}
          tone="success"
          label="Pass Rate"
          value={quiz.passRate !== null ? `${quiz.passRate}%` : "—"}
          accessibleLabel="Quiz pass rate"
        />
      </div>

      <Card className="mt-3" density="compact">
        {quiz.recentAttempts.length === 0 ? (
          <EmptyState heading="No quiz attempts yet" />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {quiz.recentAttempts.map((a) => (
              <li
                key={a.attemptId}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <Link
                  href={`/quizzes/attempts/${a.attemptId}/result`}
                  className="min-w-0 flex-1 truncate text-neutral-800 hover:text-primary-600 hover:underline"
                >
                  {a.quizTitle}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums text-neutral-500">
                    {a.percentage !== null ? `${a.percentage}%` : "—"}
                  </span>
                  {a.passed !== null ? (
                    <Chip tone={a.passed ? "success" : "danger"}>
                      {a.passed ? "Passed" : "Failed"}
                    </Chip>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
