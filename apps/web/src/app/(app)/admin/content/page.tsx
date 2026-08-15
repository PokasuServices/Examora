"use client";

import { BookOpen, CheckCircle2, FileEdit, FolderTree, Archive } from "lucide-react";
import { RequirePermission } from "@/components/require-permission";
import { Card } from "@/components/ui/card";
import { RetryInline } from "@/components/ui/retry-inline";
import { StatCard, StatCardSkeletonTile } from "@/components/dashboard/stat-card";
import { ContentShell } from "@/components/admin-content/content-shell";
import { useContentOverview } from "@/components/admin-content/use-content-overview";

function ContentOverviewContent() {
  const {
    status,
    categoryTotal,
    activeCategoryTotal,
    courseTotal,
    draftCourseTotal,
    publishedCourseTotal,
    archivedCourseTotal,
    retry,
  } = useContentOverview();

  if (status === "error") {
    return (
      <Card>
        <RetryInline message="Couldn't load content statistics" onRetry={retry} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-neutral-500">
        A real-time snapshot of the course content hierarchy and its publishing state.
      </p>

      {status === "loading" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeletonTile key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            icon={FolderTree}
            tone="primary"
            label="Categories"
            value={categoryTotal.toLocaleString()}
            accessibleLabel="Total categories"
          />
          <StatCard
            icon={CheckCircle2}
            tone="success"
            label="Active categories"
            value={activeCategoryTotal.toLocaleString()}
            accessibleLabel="Active categories"
          />
          <StatCard
            icon={BookOpen}
            tone="primary"
            label="Courses"
            value={courseTotal.toLocaleString()}
            accessibleLabel="Total courses"
          />
          <StatCard
            icon={FileEdit}
            tone="accent"
            label="Draft courses"
            value={draftCourseTotal.toLocaleString()}
            accessibleLabel="Draft courses"
          />
          <StatCard
            icon={CheckCircle2}
            tone="success"
            label="Published courses"
            value={publishedCourseTotal.toLocaleString()}
            accessibleLabel="Published courses"
          />
          <StatCard
            icon={Archive}
            tone="warning"
            label="Archived courses"
            value={archivedCourseTotal.toLocaleString()}
            accessibleLabel="Archived courses"
          />
        </div>
      )}

      <Card>
        <p className="text-sm text-neutral-500">
          Subjects, topics, modules and lessons aren&rsquo;t shown here — the backend has no
          platform-wide count for them (each list endpoint requires a specific parent course,
          subject, topic, or module), so a total would mean fetching every course&rsquo;s entire
          hierarchy just to render this page. Open a course from{" "}
          <a href="/admin/content/courses" className="text-primary-600 hover:underline">
            Courses
          </a>{" "}
          to see its full structure.
        </p>
      </Card>
    </div>
  );
}

export default function ContentOverviewPage() {
  return (
    <RequirePermission permission="content:manage">
      <ContentShell>
        <ContentOverviewContent />
      </ContentShell>
    </RequirePermission>
  );
}
