import { Suspense } from "react";
import { ApiStatus } from "@/components/api-status";
import { DashboardHub } from "@/components/dashboard-hub";
import { RequirePermission } from "@/components/require-permission";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboardPage() {
  return (
    <RequirePermission permission="analytics:admin">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Dashboard"
          subtitle="Operational tools for Examora — manage assessments, assignments, mentoring, community, commerce, and notifications."
          actions={
            <Suspense fallback={<Skeleton className="h-7 w-28 rounded-md" />}>
              <ApiStatus />
            </Suspense>
          }
        />
        <DashboardHub />
      </main>
    </RequirePermission>
  );
}
