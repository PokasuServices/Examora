"use client";

import * as React from "react";
import { Users } from "lucide-react";
import { RequirePermission } from "@/components/require-permission";
import { RetryInline } from "@/components/ui/retry-inline";
import { EmptyState } from "@/components/ui/empty-state";
import { CatalogSearchInput } from "@/components/courses/catalog-filters";
import { SelectField, type SelectFieldOption } from "@/components/ui/select-field";
import { useMentorStudents, type MergedStudent } from "@/components/mentor/use-mentor-students";
import { StudentTable } from "@/components/mentor/student-table";
import { StudentListSkeleton } from "@/components/mentor/skeletons";
import type { ActivityBucket } from "@/components/mentor/activity-status";

type StatusFilter = "all" | ActivityBucket;
type SortOption = "name" | "progress" | "quiz" | "assignment" | "last-active";

const STATUS_OPTIONS: SelectFieldOption[] = [
  { value: "all", label: "All students" },
  { value: "active", label: "Active" },
  { value: "check-in", label: "Check in soon" },
  { value: "at-risk", label: "Needs attention" },
  { value: "never-started", label: "Never started" },
];

const SORT_OPTIONS: SelectFieldOption[] = [
  { value: "last-active", label: "Last activity" },
  { value: "name", label: "Name A–Z" },
  { value: "progress", label: "Progress" },
  { value: "quiz", label: "Quiz average" },
  { value: "assignment", label: "Assignment average" },
];

function sortStudents(students: MergedStudent[], sort: SortOption): MergedStudent[] {
  const sorted = [...students];
  switch (sort) {
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "progress":
      sorted.sort((a, b) => b.overallCompletionPercent - a.overallCompletionPercent);
      break;
    case "quiz":
      sorted.sort((a, b) => (b.quizAverage ?? -1) - (a.quizAverage ?? -1));
      break;
    case "assignment":
      sorted.sort((a, b) => (b.assignmentAverage ?? -1) - (a.assignmentAverage ?? -1));
      break;
    case "last-active":
    default:
      sorted.sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? ""));
      break;
  }
  return sorted;
}

function MentorStudentsContent() {
  const { status, students, retry } = useMentorStudents();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [sort, setSort] = React.useState<SortOption>("last-active");

  if (status === "loading") {
    return <StudentListSkeleton />;
  }

  if (status === "error") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <RetryInline message="Couldn't load your students" onRetry={retry} />
      </main>
    );
  }

  const filtered = sortStudents(
    students.filter((s) => {
      // "at-risk" matches the backend's own studentsInactive14Days definition
      // exactly: everyone NOT active in the last 14 days, which includes
      // students who have never been active — not just those who went quiet.
      // Keeps this filter and the Dashboard's "Need Attention" count in sync.
      if (statusFilter === "at-risk" && s.bucket !== "at-risk" && s.bucket !== "never-started") {
        return false;
      }
      if (statusFilter !== "all" && statusFilter !== "at-risk" && s.bucket !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false;
      }
      return true;
    }),
    sort,
  );

  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
          My Students
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {students.length} assigned {students.length === 1 ? "student" : "students"}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <CatalogSearchInput id="student-search" value={search} onChange={setSearch} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
          <SelectField
            id="status-filter"
            label="Status"
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />
          <SelectField
            id="sort-by"
            label="Sort by"
            value={sort}
            options={SORT_OPTIONS}
            onChange={(v) => setSort(v as SortOption)}
          />
        </div>
      </div>

      {students.length === 0 ? (
        <EmptyState icon={Users} heading="No students assigned yet" />
      ) : filtered.length === 0 ? (
        <EmptyState heading="No students match your filters" />
      ) : (
        <StudentTable students={filtered} />
      )}
    </main>
  );
}

export default function MentorStudentsPage() {
  return (
    <RequirePermission permission="mentor:workflow">
      <MentorStudentsContent />
    </RequirePermission>
  );
}
