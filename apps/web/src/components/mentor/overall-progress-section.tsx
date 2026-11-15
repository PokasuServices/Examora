import { BookOpen, CheckCircle2, GraduationCap } from "lucide-react";
import type { LearningDashboard } from "@examora/types";
import { Card } from "@/components/ui/card";

export function OverallProgressSection({ stats }: { stats: LearningDashboard["stats"] }) {
  return (
    <section aria-labelledby="overall-progress-heading">
      <h2
        id="overall-progress-heading"
        className="text-lg font-medium text-neutral-800 dark:text-white/90"
      >
        Overall Progress
      </h2>
      <Card className="mt-3">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <GraduationCap size={14} strokeWidth={1.75} aria-hidden="true" />
              Courses started
            </div>
            <p className="mt-1 text-xl font-semibold text-neutral-800 dark:text-white/90">
              {stats.coursesStarted}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true" />
              Completed
            </div>
            <p className="mt-1 font-heading text-2xl font-bold text-success-600 dark:text-success-400">
              {stats.coursesCompleted}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <BookOpen size={14} strokeWidth={1.75} aria-hidden="true" />
              Lessons done
            </div>
            <p className="mt-1 text-xl font-semibold text-neutral-800 dark:text-white/90">
              {stats.lessonsCompleted}
            </p>
          </div>
        </div>
      </Card>
    </section>
  );
}
