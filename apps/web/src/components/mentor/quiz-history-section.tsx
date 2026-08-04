import type { AdminAttemptSummary } from "@examora/types";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCircle } from "lucide-react";

export function QuizHistorySection({ attempts }: { attempts: AdminAttemptSummary[] }) {
  return (
    <section aria-labelledby="quiz-history-heading">
      <h2 id="quiz-history-heading" className="font-heading text-lg font-semibold text-neutral-900">
        Quiz Performance
      </h2>
      <Card className="mt-3">
        {attempts.length === 0 ? (
          <EmptyState icon={HelpCircle} heading="No quiz attempts yet" />
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-100">
            {attempts.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-neutral-700">{a.quizTitle}</span>
                {a.percentage !== null ? (
                  <span className="shrink-0 tabular-nums text-neutral-500">{a.percentage}%</span>
                ) : null}
                <Chip
                  tone={a.passed === true ? "success" : a.passed === false ? "danger" : "neutral"}
                >
                  {a.passed === true ? "Passed" : a.passed === false ? "Not passed" : a.status}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
