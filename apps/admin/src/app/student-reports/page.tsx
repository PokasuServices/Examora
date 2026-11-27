"use client";

import * as React from "react";
import { useAuth } from "@examora/auth-client";
import { RequirePermission } from "@/components/require-permission";
import { PageHeader } from "@/components/ui/page-header";
import { AdminReportsQueue, MentorReports } from "@/components/mentor-reports";

function ReportsContent() {
  const { user } = useAuth();
  if (user?.permissions.includes("deletion:review")) {
    return (
      <main className="flex flex-col gap-6">
        <PageHeader
          title="Student reports"
          subtitle="Report cards, alerts and meeting notes from mentors. Approve them before they reach parents, or send them back with a note."
        />
        <AdminReportsQueue />
      </main>
    );
  }
  return <MentorReports />;
}

export default function StudentReportsPage() {
  return (
    <RequirePermission permission="mentor:workflow">
      <React.Suspense fallback={null}>
        <ReportsContent />
      </React.Suspense>
    </RequirePermission>
  );
}
