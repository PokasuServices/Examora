import { CalendarClock, ListTodo, Users } from "lucide-react";
import type { MentorWorkloadSummary } from "@examora/types";
import { StatCard } from "@/components/dashboard/stat-card";

export function WorkloadSection({ workload }: { workload: MentorWorkloadSummary }) {
  return (
    <section aria-labelledby="mentor-workload-heading">
      <h2
        id="mentor-workload-heading"
        className="font-heading text-lg font-semibold text-neutral-900"
      >
        Workload
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={Users}
          tone="primary"
          label="Active Students"
          value={`${workload.activeStudentCount}/${workload.maxStudents}`}
          accessibleLabel="Active students out of maximum caseload"
        />
        <StatCard
          icon={Users}
          tone="accent"
          label="Utilization"
          value={`${workload.utilizationPercent}%`}
          accessibleLabel="Caseload utilization percentage"
        />
        <StatCard
          icon={ListTodo}
          tone="warning"
          label="Pending Tasks"
          value={String(workload.pendingTasksCount)}
          accessibleLabel="Pending tasks"
        />
        <StatCard
          icon={CalendarClock}
          tone="success"
          label="Upcoming Meetings"
          value={String(workload.upcomingMeetingsCount)}
          accessibleLabel="Upcoming meetings"
        />
      </div>
    </section>
  );
}
